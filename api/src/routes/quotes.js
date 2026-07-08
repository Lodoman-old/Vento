import { Router } from "express";
import { authenticate, authorize, checkEventAccess } from "../middleware/auth.js";
import { quoteRules, quoteUpdateRules } from "../middleware/validate.js";
import { query } from "../services/db.js";
import { createNotification } from "../services/notifications.js";

const router = Router();

router.use(authenticate);

// GET /api/quotes?eventId=
router.get("/", checkEventAccess, async (req, res) => {
  try {
    const { eventId } = req.query;
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

    res.json({ ...quote[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes
router.post("/", authorize("administrador"), ...quoteRules, async (req, res) => {
  try {
    const { eventId, clientName, clientPhone, items } = req.body;

    const userTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    // Fetch supplier costs for this event
    const { rows: supplierCosts } = await query(
      `SELECT sc.name, es.budget_amount
       FROM event_suppliers es
       JOIN supplier_catalog sc ON sc.id = es.supplier_id
       WHERE es.event_id = $1 AND es.budget_amount > 0`,
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
    for (const item of items) {
      await query(
        `INSERT INTO quote_items (quote_id, item_name, quantity, unit_price, is_supplier_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [quoteId, item.itemName, item.quantity, item.unitPrice, false]
      );
    }
    for (const sup of supplierCosts) {
      await query(
        `INSERT INTO quote_items (quote_id, item_name, quantity, unit_price, is_supplier_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [quoteId, sup.name, 1, sup.budget_amount, true]
      );
    }

    const { rows: fullItems } = await query("SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY is_supplier_cost, id", [quoteId]);
    res.status(201).json({ ...quote[0], items: fullItems });
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
    const { clientName, clientPhone, items } = req.body;

    const { rows: existing } = await query("SELECT status, event_id FROM quotes WHERE id = $1", [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: "No encontrada" });
    if (existing[0].status !== "borrador") return res.status(400).json({ error: "Solo se puede editar cotizaciones en borrador" });

    const eventId = existing[0].event_id;

    const userTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    // Fetch supplier costs for this event
    const { rows: supplierCosts } = await query(
      `SELECT sc.name, es.budget_amount
       FROM event_suppliers es
       JOIN supplier_catalog sc ON sc.id = es.supplier_id
       WHERE es.event_id = $1 AND es.budget_amount > 0`,
      [eventId]
    );
    const supplierTotal = supplierCosts.reduce((sum, s) => sum + Number(s.budget_amount), 0);
    const total = userTotal + supplierTotal;

    const { rows: quote } = await query(
      `UPDATE quotes SET client_name = $1, client_phone = $2, total = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
      [clientName, clientPhone, total, req.params.id]
    );

    await query("DELETE FROM quote_items WHERE quote_id = $1", [req.params.id]);

    for (const item of items) {
      await query(
        `INSERT INTO quote_items (quote_id, item_name, quantity, unit_price, is_supplier_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, item.itemName, item.quantity, item.unitPrice, false]
      );
    }
    for (const sup of supplierCosts) {
      await query(
        `INSERT INTO quote_items (quote_id, item_name, quantity, unit_price, is_supplier_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, sup.name, 1, sup.budget_amount, true]
      );
    }

    const { rows: fullItems } = await query("SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY is_supplier_cost, id", [req.params.id]);
    res.json({ ...quote[0], items: fullItems });
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
