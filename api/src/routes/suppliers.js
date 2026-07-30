import { Router } from "express";
import { authenticate, authorize, checkEventAccess } from "../middleware/auth.js";
import { query } from "../services/db.js";
import { getIO } from "../socket.js";
import { publishToRedis } from "../services/redis.js";
import { notifyAdmins } from "../services/notifications.js";

const router = Router();
router.use(authenticate);

// Helper: sincroniza costos de proveedores en cotizaciones borrador del evento
async function syncQuotesWithSuppliers(eventId) {
  const { rows: quotes } = await query(
    "SELECT id, total FROM quotes WHERE event_id = $1 AND status = 'borrador'",
    [eventId]
  );
  if (quotes.length === 0) return;

  const { rows: supplierCosts } = await query(
    `SELECT COALESCE(SUM(es.budget_amount), 0) AS total
     FROM event_suppliers es
     WHERE es.event_id = $1`,
    [eventId]
  );
  const currentSupplierTotal = Number(supplierCosts[0].total);

  for (const q of quotes) {
    // Recalculate total: user items + all supplier costs
    const { rows: userItems } = await query(
      "SELECT COALESCE(SUM(subtotal), 0) AS total FROM quote_items WHERE quote_id = $1 AND is_supplier_cost = false",
      [q.id]
    );
    const newTotal = Number(userItems[0].total) + currentSupplierTotal;

    await query("UPDATE quotes SET total = $1, updated_at = NOW() WHERE id = $2", [newTotal, q.id]);
    await query("DELETE FROM quote_items WHERE quote_id = $1 AND is_supplier_cost = true", [q.id]);
    await query("DELETE FROM payments WHERE quote_id = $1 AND method IN ('enganche', 'mensualidad')", [q.id]);

    // Re-insert current supplier costs as quote items
    const { rows: suppliers } = await query(
      `SELECT sc.name, es.budget_amount
       FROM event_suppliers es
       JOIN supplier_catalog sc ON sc.id = es.supplier_id
       WHERE es.event_id = $1 AND es.budget_amount > 0`,
      [eventId]
    );
    for (const s of suppliers) {
      await query(
        `INSERT INTO quote_items (quote_id, item_name, quantity, unit_price, is_supplier_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [q.id, s.name, 1, s.budget_amount, true]
      );
    }

    // Regenerate payment plan with the new total
    const { rows: [ev] } = await query("SELECT date FROM events WHERE id = $1", [eventId]);
    if (ev && newTotal > 0) {
      const now = new Date();
      const eventDt = new Date(ev.date);
      const durationMs = eventDt - now;
      if (durationMs > 0) {
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        const monthsUntil = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24 * 30.44)));
        const numPayments = Math.max(2, monthsUntil);
        const downAmount = Math.round(newTotal * 0.30 * 100) / 100;
        const remaining = newTotal - downAmount;
        const perInstallment = Math.round((remaining / (numPayments - 1)) * 100) / 100;
        const lastInstallment = Math.round((remaining - perInstallment * (numPayments - 2)) * 100) / 100;
        const p0Ms = Math.min(oneWeekMs, durationMs * 0.15);
        const pLastMs = Math.max(durationMs - oneWeekMs, durationMs * 0.85);
        const dates = [new Date(now.getTime() + p0Ms)];
        if (numPayments > 2) {
          const gap = (pLastMs - p0Ms) / (numPayments - 2);
          for (let i = 1; i < numPayments - 1; i++) dates.push(new Date(now.getTime() + p0Ms + gap * i));
        }
        dates.push(new Date(now.getTime() + pLastMs));
        const amounts = [downAmount];
        for (let i = 1; i < numPayments - 1; i++) amounts.push(perInstallment);
        amounts.push(lastInstallment);
        const labels = ["Enganche 30% - Apartar fecha"];
        for (let i = 1; i < numPayments; i++) {
          labels.push(numPayments === 2 ? "Pago final" : `Mensualidad ${i}/${numPayments - 1}`);
        }
        const methods = ["enganche", ...Array(numPayments - 1).fill("mensualidad")];
        for (let i = 0; i < numPayments; i++) {
          await query(
            `INSERT INTO payments (quote_id, amount, payment_date, method, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [q.id, amounts[i], dates[i], methods[i], labels[i]]
          );
        }
      }
    }
  }
}

// GET /api/event-suppliers?eventId=
router.get("/", checkEventAccess, async (req, res) => {
  try {
    const eventId = req.query.event_id || req.query.eventId;
    const { rows } = await query(
      `SELECT es.*, sc.name, sc.contact_name, sc.phone, sc.email, sc.category, sc.service_description
       FROM event_suppliers es
       JOIN supplier_catalog sc ON sc.id = es.supplier_id
       WHERE es.event_id = $1
       ORDER BY sc.category, sc.name`,
      [eventId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/event-suppliers — asignar proveedor a evento
router.post("/", authorize("administrador"), async (req, res) => {
  try {
    const eventId = req.body.event_id || req.body.eventId;
    const supplierId = req.body.supplier_id || req.body.supplierId;
    const budgetAmount = req.body.budget_amount ?? req.body.budgetAmount;
    const arrivalTime = req.body.arrival_time ?? req.body.arrivalTime;
    const { rows } = await query(
      `INSERT INTO event_suppliers (event_id, supplier_id, budget_amount, arrival_time)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [eventId, supplierId, budgetAmount || 0, arrivalTime || null]
    );
    const es = rows[0];
    const { rows: catalog } = await query("SELECT * FROM supplier_catalog WHERE id = $1", [supplierId]);

    getIO().to(`event:${eventId}`).emit("supplier:updated", { ...es, ...catalog[0] });

    await notifyAdmins({
      eventId,
      title: "Proveedor asignado",
      body: `Proveedor "${catalog[0].name}" asignado al evento`,
      type: "supplier",
    });
    await publishToRedis("supplier:updated", `event:${eventId}`, { event_id: eventId, supplier_id: supplierId, action: "INSERT" });

    // Sincronizar cotizaciones borrador
    syncQuotesWithSuppliers(eventId).catch(e => console.error("[sync] error tras asignar proveedor:", e.message));

    res.status(201).json({ ...es, ...catalog[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "El proveedor ya está asignado a este evento" });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/event-suppliers/:id — actualizar estado, llegada, etc.
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    let idx = 1;

    const map = {
      contract_status: "contract_status", contractStatus: "contract_status",
      budget_amount: "budget_amount", budgetAmount: "budget_amount",
      arrival_time: "arrival_time", arrivalTime: "arrival_time",
      actual_arrival_time: "actual_arrival_time", actualArrivalTime: "actual_arrival_time",
      notes: "notes",
    };

    for (const [key, col] of Object.entries(map)) {
      if (req.body[key] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: "Sin campos para actualizar" });

    values.push(id);
    const { rows } = await query(
      `UPDATE event_suppliers SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });

    const es = rows[0];
    const { rows: catalog } = await query("SELECT * FROM supplier_catalog WHERE id = $1", [es.supplier_id]);
    const result = { ...es, ...catalog[0] };

    // Auto-generar agenda item cuando el proveedor reporta llegada
    if (es.actual_arrival_time && !req.body._agendaCreated) {
      const name = catalog[0]?.name || "Proveedor";
      const arrivalDate = new Date(es.actual_arrival_time);
      const time = `${arrivalDate.getHours().toString().padStart(2, '0')}:${arrivalDate.getMinutes().toString().padStart(2, '0')}`;
      await query(
        `INSERT INTO agenda_items (event_id, title, description, start_time, is_completed)
         VALUES ($1, $2, $3, $4, true)`,
        [es.event_id, `🛻 Llegada: ${name}`, `El proveedor "${name}" reportó llegada a las ${time}`, es.actual_arrival_time]
      );
      // Marcar para no duplicar en caso de que el frontend re-envíe
      req.body._agendaCreated = true;
    }

    getIO().to(`event:${es.event_id}`).emit("supplier:updated", result);
    await publishToRedis("supplier:updated", `event:${es.event_id}`, { event_id: es.event_id, supplier_id: es.supplier_id, action: "UPDATE" });

    // Sincronizar cotizaciones borrador si cambió el presupuesto
    if (req.body.budget_amount !== undefined || req.body.budgetAmount !== undefined) {
      syncQuotesWithSuppliers(es.event_id).catch(e => console.error("[sync] error tras actualizar proveedor:", e.message));
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/event-suppliers/:id — quitar proveedor del evento (no borra del catálogo)
router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query("DELETE FROM event_suppliers WHERE id = $1 RETURNING *", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });

    getIO().to(`event:${rows[0].event_id}`).emit("supplier:removed", { id: rows[0].id });
    await publishToRedis("supplier:removed", `event:${rows[0].event_id}`, { event_id: rows[0].event_id, supplier_id: rows[0].supplier_id, action: "DELETE" });

    // Sincronizar cotizaciones borrador
    syncQuotesWithSuppliers(rows[0].event_id).catch(e => console.error("[sync] error tras quitar proveedor:", e.message));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
