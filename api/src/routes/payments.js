import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query } from "../services/db.js";

const router = Router();
router.use(authenticate);

// GET /api/payments?quoteId=
router.get("/", authorize("administrador"), async (req, res) => {
  try {
    const quoteId = req.query.quote_id || req.query.quoteId;
    const { rows } = await query(
      "SELECT * FROM payments WHERE quote_id = $1 ORDER BY payment_date ASC",
      [quoteId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function applyPayment(quoteId, amount, appliedToId) {
  const { rows: [planned] } = await query(
    "SELECT * FROM payments WHERE id = $1 AND quote_id = $2",
    [appliedToId, quoteId]
  );
  if (!planned) return { applied: 0, excess: amount };

  const paidSoFar = parseFloat(planned.paid_amount) || 0;
  const plannedAmount = parseFloat(planned.amount);
  const remaining = plannedAmount - paidSoFar;

  if (amount <= remaining) {
    await query("UPDATE payments SET paid_amount = paid_amount + $1 WHERE id = $2", [amount, appliedToId]);
    return { applied: amount, excess: 0 };
  }

  // Pay off this planned payment fully
  await query("UPDATE payments SET paid_amount = $1 WHERE id = $2", [plannedAmount, appliedToId]);
  const excess = amount - remaining;

  // Find next planned payment
  const { rows: nextPlanned } = await query(
    `SELECT * FROM payments WHERE quote_id = $1 AND id != $2 AND method IN ('enganche','mensualidad')
     AND (paid_amount IS NULL OR paid_amount < amount) ORDER BY payment_date ASC LIMIT 1`,
    [quoteId, appliedToId]
  );
  if (nextPlanned.length === 0) return { applied: amount, excess };

  return applyPayment(quoteId, excess, nextPlanned[0].id);
}

// POST /api/payments
router.post("/", authorize("administrador"), async (req, res) => {
  try {
    const quoteId = req.body.quote_id || req.body.quoteId;
    const amount = parseFloat(req.body.amount);
    const paymentDate = req.body.payment_date || req.body.paymentDate;
    const method = req.body.method || "efectivo";
    const reference = req.body.reference || null;
    const notes = req.body.notes || null;
    const appliedTo = req.body.applied_to || req.body.appliedTo || null;

    const { rows } = await query(
      `INSERT INTO payments (quote_id, amount, payment_date, method, reference, notes, applied_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [quoteId, amount, paymentDate || new Date(), method, reference, notes, appliedTo]
    );

    if (appliedTo) {
      await applyPayment(quoteId, amount, appliedTo);
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/payments/:id
router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    await query("DELETE FROM payments WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
