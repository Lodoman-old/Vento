import { Router } from "express";
import { authenticate, authorize, checkEventAccess } from "../middleware/auth.js";
import { quoteRules, quoteUpdateRules } from "../middleware/validate.js";
import { query } from "../services/db.js";
import { createNotification } from "../services/notifications.js";

async function generatePaymentPlan(quoteId, total, eventId) {
  if (total <= 0) return;

  const { rows: [ev] } = await query("SELECT date FROM events WHERE id = $1", [eventId]);
  if (!ev) return;

  const now = new Date();
  const eventDt = new Date(ev.date);
  const durationMs = eventDt - now;
  if (durationMs <= 0) return;

  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  // Number of payments = months until event (min 2)
  const monthsUntil = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24 * 30.44)));
  const numPayments = Math.max(2, monthsUntil);

  const downAmount = Math.round(total * 0.30 * 100) / 100;
  const remainingTotal = total - downAmount;

  // Equal amounts for remaining payments
  const perInstallment = Math.round((remainingTotal / (numPayments - 1)) * 100) / 100;
  const lastInstallment = Math.round((remainingTotal - perInstallment * (numPayments - 2)) * 100) / 100;

  // Payment dates
  // Date 0: anticipo at now + 1 week (or at duration * 0.15 if event is very close)
  const p0Ms = Math.min(oneWeekMs, durationMs * 0.15);
  // Last payment: 1 week before event (or at duration * 0.85 if very close)
  const pLastMs = Math.max(durationMs - oneWeekMs, durationMs * 0.85);

  const dates = [new Date(now.getTime() + p0Ms)];
  if (numPayments > 2) {
    const gap = (pLastMs - p0Ms) / (numPayments - 2);
    for (let i = 1; i < numPayments - 1; i++) {
      dates.push(new Date(now.getTime() + p0Ms + gap * i));
    }
  }
  dates.push(new Date(now.getTime() + pLastMs));

  // Build amounts array
  const amounts = [downAmount];
  for (let i = 1; i < numPayments - 1; i++) amounts.push(perInstallment);
  amounts.push(lastInstallment);

  // Labels & methods
  const labels = ["Enganche 30% - Apartar fecha"];
  for (let i = 1; i < numPayments; i++) {
    labels.push(numPayments === 2 ? "Pago final" : `Mensualidad ${i}/${numPayments - 1}`);
  }
  const methods = ["enganche", ...Array(numPayments - 1).fill("mensualidad")];

  for (let i = 0; i < numPayments; i++) {
    await query(
      `INSERT INTO payments (quote_id, amount, payment_date, method, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [quoteId, amounts[i], dates[i], methods[i], labels[i]]
    );
  }
}

const router = Router();

router.use(authenticate);

// GET /api/quotes?eventId=
router.get("/", checkEventAccess, async (req, res) => {
  try {
    const eventId = req.query.event_id || req.query.eventId;
    const { rows } = await query(
      "SELECT * FROM quotes WHERE event_id = $1 ORDER BY created_at DESC",
      [eventId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quotes/:id (con items)
router.get("/:id", async (req, res) => {
  try {
    const { rows: quote } = await query("SELECT * FROM quotes WHERE id = $1", [req.params.id]);
    if (quote.length === 0) return res.status(404).json({ error: "No encontrada" });

    // check event access for non-admin users
    if (req.user.role !== "administrador") {
      if (req.user.role === "cliente") {
        const { rows: ev } = await query("SELECT 1 FROM events WHERE id = $1 AND client_id = $2", [quote[0].event_id, req.user.id]);
        if (ev.length === 0) return res.status(403).json({ error: "No tienes acceso" });
      } else {
        const { rows: es } = await query("SELECT 1 FROM event_staff WHERE event_id = $1 AND user_id = $2", [quote[0].event_id, req.user.id]);
        if (es.length === 0) return res.status(403).json({ error: "No tienes acceso" });
      }
    }

    const { rows: items } = await query("SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY id", [req.params.id]);
    const { rows: payments } = await query("SELECT * FROM payments WHERE quote_id = $1 ORDER BY payment_date", [req.params.id]);

    res.json({ ...quote[0], items, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes
router.post("/", authorize("administrador"), ...quoteRules, async (req, res) => {
  try {
    const eventId = req.body.event_id || req.body.eventId;
    const clientName = req.body.client_name ?? req.body.clientName;
    const clientPhone = req.body.client_phone ?? req.body.clientPhone;
    const items = req.body.items || [];

    const normalizeItem = (i) => ({
      itemName: i.item_name || i.itemName,
      unitPrice: i.unit_price ?? i.unitPrice,
      quantity: i.quantity,
      needsReturn: i.needs_return ?? i.needsReturn ?? false,
    });
    const userTotal = items.reduce((sum, i) => sum + (i.quantity || 1) * (normalizeItem(i).unitPrice || 0), 0);

    // Fetch supplier costs for this event
    const { rows: supplierCosts } = await query(
      `SELECT sc.name, COALESCE(es.budget_amount, 0) AS budget_amount
        FROM event_suppliers es
        JOIN supplier_catalog sc ON sc.id = es.supplier_id
        WHERE es.event_id = $1`,
      [eventId]
    );
    const supplierTotal = supplierCosts.reduce((sum, s) => sum + Number(s.budget_amount), 0);
    const total = userTotal + supplierTotal;

    const { rows: quote } = await query(
      `INSERT INTO quotes (event_id, client_name, client_phone, total, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [eventId, clientName, clientPhone, total, req.user.id]
    );

    const quoteId = quote[0].id;
    for (const raw of items) {
      const item = normalizeItem(raw);
      await query(
        `INSERT INTO quote_items (quote_id, item_name, quantity, unit_price, is_supplier_cost, needs_return)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [quoteId, item.itemName, item.quantity, item.unitPrice, false, item.needsReturn]
      );
    }
    for (const sup of supplierCosts) {
      await query(
        `INSERT INTO quote_items (quote_id, item_name, quantity, unit_price, is_supplier_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [quoteId, sup.name, 1, sup.budget_amount, true]
      );
    }

    await generatePaymentPlan(quoteId, total, eventId);

    const { rows: fullItems } = await query("SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY is_supplier_cost, id", [quoteId]);
    const { rows: payments } = await query("SELECT * FROM payments WHERE quote_id = $1 ORDER BY payment_date", [quoteId]);
    res.status(201).json({ ...quote[0], items: fullItems, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/quotes/:id/status
router.patch("/:id/status", authorize("administrador"), async (req, res) => {
  try {
    const { status } = req.body;
    const { rows: old } = await query("SELECT status, event_id, client_name FROM quotes WHERE id = $1", [req.params.id]);
    if (old.length === 0) return res.status(404).json({ error: "No encontrada" });

    const { rows } = await query(
      "UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );

    if (status !== old[0].status) {
      const statusLabels = { enviado: "Enviada", aceptado: "Aceptada", rechazado: "Rechazada" };
      await createNotification({
        userId: req.user.id,
        eventId: old[0].event_id,
        title: `Cotización ${statusLabels[status] || status}`,
        body: `Cotización de ${old[0].client_name || "cliente"} ${statusLabels[status]?.toLowerCase() || status}`,
        type: "quote",
      });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/quotes/:id
router.put("/:id", authorize("administrador"), ...quoteUpdateRules, async (req, res) => {
  try {
    const clientName = req.body.client_name ?? req.body.clientName;
    const clientPhone = req.body.client_phone ?? req.body.clientPhone;
    const items = req.body.items || [];

    const { rows: existing } = await query("SELECT status, event_id FROM quotes WHERE id = $1", [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: "No encontrada" });
    if (existing[0].status !== "borrador") return res.status(400).json({ error: "Solo se puede editar cotizaciones en borrador" });

    const eventId = existing[0].event_id;

    const normalizeItem = (i) => ({
      itemName: i.item_name || i.itemName,
      unitPrice: i.unit_price ?? i.unitPrice,
      quantity: i.quantity,
      needsReturn: i.needs_return ?? i.needsReturn ?? false,
    });
    const userTotal = items.reduce((sum, i) => sum + (i.quantity || 1) * (normalizeItem(i).unitPrice || 0), 0);

    // Fetch supplier costs for this event
    const { rows: supplierCosts } = await query(
      `SELECT sc.name, COALESCE(es.budget_amount, 0) AS budget_amount
        FROM event_suppliers es
        JOIN supplier_catalog sc ON sc.id = es.supplier_id
        WHERE es.event_id = $1`,
      [eventId]
    );
    const supplierTotal = supplierCosts.reduce((sum, s) => sum + Number(s.budget_amount), 0);
    const total = userTotal + supplierTotal;

    const { rows: quote } = await query(
      `UPDATE quotes SET client_name = $1, client_phone = $2, total = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
      [clientName, clientPhone, total, req.params.id]
    );

    await query("DELETE FROM quote_items WHERE quote_id = $1", [req.params.id]);

    for (const raw of items) {
      const item = normalizeItem(raw);
      await query(
        `INSERT INTO quote_items (quote_id, item_name, quantity, unit_price, is_supplier_cost, needs_return)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.params.id, item.itemName, item.quantity, item.unitPrice, false, item.needsReturn]
      );
    }
    for (const sup of supplierCosts) {
      await query(
        `INSERT INTO quote_items (quote_id, item_name, quantity, unit_price, is_supplier_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, sup.name, 1, sup.budget_amount, true]
      );
    }

    await query("DELETE FROM payments WHERE quote_id = $1 AND method IN ('enganche', 'mensualidad')", [req.params.id]);
    await generatePaymentPlan(req.params.id, total, eventId);

    const { rows: fullItems } = await query("SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY is_supplier_cost, id", [req.params.id]);
    const { rows: payments } = await query("SELECT * FROM payments WHERE quote_id = $1 ORDER BY payment_date", [req.params.id]);
    res.json({ ...quote[0], items: fullItems, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/regenerate-payments
router.post("/:id/regenerate-payments", authorize("administrador"), async (req, res) => {
  try {
    const { rows: quote } = await query("SELECT event_id, total FROM quotes WHERE id = $1", [req.params.id]);
    if (quote.length === 0) return res.status(404).json({ error: "Cotización no encontrada" });

    await query("DELETE FROM payments WHERE quote_id = $1 AND method IN ('enganche', 'mensualidad')", [req.params.id]);
    await generatePaymentPlan(req.params.id, Number(quote[0].total), quote[0].event_id);

    const { rows: payments } = await query("SELECT * FROM payments WHERE quote_id = $1 ORDER BY payment_date", [req.params.id]);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/quotes/:id
router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    const result = await query("DELETE FROM quotes WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "No encontrada" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
