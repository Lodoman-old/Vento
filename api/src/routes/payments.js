import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query } from "../services/db.js";

const router = Router();
router.use(authenticate);

// GET /api/payments?quoteId=
router.get("/", authorize("administrador"), async (req, res) => {
  try {
    const { quoteId } = req.query;
    const { rows } = await query(
      "SELECT * FROM payments WHERE quote_id = $1 ORDER BY payment_date DESC",
      [quoteId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments
router.post("/", authorize("administrador"), async (req, res) => {
  try {
    const { quoteId, amount, paymentDate, method, reference, notes } = req.body;
    const { rows } = await query(
      `INSERT INTO payments (quote_id, amount, payment_date, method, reference, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [quoteId, amount, paymentDate || new Date(), method || "efectivo", reference, notes]
    );
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
