import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query } from "../services/db.js";

const router = Router();
router.use(authenticate);

// GET /api/reports/events?start=&end=
router.get("/events", authorize("administrador"), async (req, res) => {
  try {
    const start = req.query.start || "2000-01-01";
    const end = req.query.end || "2099-12-31";
    const { rows } = await query(
      `SELECT e.*,
        COALESCE((SELECT SUM(total) FROM quotes WHERE event_id = e.id), 0) AS quoted_total,
        COALESCE((SELECT SUM(amount) FROM payments p JOIN quotes q ON q.id = p.quote_id WHERE q.event_id = e.id AND p.method NOT IN ('enganche','mensualidad')), 0) AS paid_total,
        COALESCE((SELECT SUM(amount) FROM payments p JOIN quotes q ON q.id = p.quote_id WHERE q.event_id = e.id AND p.method IN ('enganche','mensualidad') AND (p.paid_amount IS NULL OR p.paid_amount < p.amount)), 0) AS pending_total,
        (SELECT COUNT(*) FROM event_staff WHERE event_id = e.id) AS staff_count,
        (SELECT COUNT(*) FROM supplier_catalog sc JOIN event_suppliers es ON es.supplier_id = sc.id WHERE es.event_id = e.id) AS supplier_count
       FROM events e
       WHERE e.date BETWEEN $1 AND $2
       ORDER BY e.date`,
      [start, end]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/clients
router.get("/clients", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.display_name, u.email, u.phone, u.created_at,
        (SELECT COUNT(*) FROM events WHERE client_id = u.id) AS event_count,
        (SELECT COALESCE(SUM(total), 0) FROM quotes q JOIN events e ON e.id = q.event_id WHERE e.client_id = u.id) AS total_spent,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN quotes q ON q.id = p.quote_id JOIN events e ON e.id = q.event_id WHERE e.client_id = u.id AND p.method NOT IN ('enganche','mensualidad')) AS total_paid
       FROM users u
       WHERE u.role = 'cliente' AND u.is_active = true
       ORDER BY u.display_name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/suppliers?category=
router.get("/suppliers", authorize("administrador"), async (req, res) => {
  try {
    let sql = `SELECT sc.*,
      (SELECT COUNT(*) FROM event_suppliers WHERE supplier_id = sc.id) AS event_count,
      (SELECT COALESCE(SUM(budget_amount), 0) FROM event_suppliers WHERE supplier_id = sc.id) AS total_budgeted,
      (SELECT COALESCE(SUM(paid_amount), 0) FROM event_suppliers WHERE supplier_id = sc.id) AS total_paid
     FROM supplier_catalog sc`;
    const params = [];
    if (req.query.category) {
      sql += " WHERE sc.category = $1";
      params.push(req.query.category);
    }
    sql += " ORDER BY sc.name";
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/supplier-categories
router.get("/supplier-categories", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query("SELECT DISTINCT category FROM supplier_catalog ORDER BY category");
    res.json(rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/catalog?category=
router.get("/catalog", authorize("administrador"), async (req, res) => {
  try {
    let sql = "SELECT * FROM catalog_items WHERE is_active = true";
    const params = [];
    if (req.query.category) {
      sql += " AND category = $1";
      params.push(req.query.category);
    }
    sql += " ORDER BY category, name";
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/categories
router.get("/categories", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT DISTINCT category FROM catalog_items WHERE is_active = true ORDER BY category"
    );
    res.json(rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/financial?start=&end=
router.get("/financial", authorize("administrador"), async (req, res) => {
  try {
    const start = req.query.start || "2000-01-01";
    const end = req.query.end || "2099-12-31";
    const { rows: summary } = await query(
      `SELECT
        COUNT(DISTINCT p.id) AS payment_count,
        COALESCE(SUM(p.amount), 0) AS total_received,
        COUNT(DISTINCT p.quote_id) AS quotes_with_payment,
        COALESCE((SELECT SUM(total) FROM quotes WHERE created_at BETWEEN $1 AND $2), 0) AS total_quoted
       FROM payments p
       JOIN quotes q ON q.id = p.quote_id
       WHERE p.method NOT IN ('enganche','mensualidad')
        AND p.created_at BETWEEN $1 AND $2`,
      [start, end]
    );
    const { rows: byMethod } = await query(
      `SELECT p.method, COUNT(*)::int AS count, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       JOIN quotes q ON q.id = p.quote_id
       WHERE p.method NOT IN ('enganche','mensualidad')
        AND p.created_at BETWEEN $1 AND $2
       GROUP BY p.method ORDER BY total DESC`,
      [start, end]
    );
    res.json({ ...summary[0], by_method: byMethod });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
