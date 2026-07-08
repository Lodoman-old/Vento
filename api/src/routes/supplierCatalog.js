import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query } from "../services/db.js";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM supplier_catalog ORDER BY category, name");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authorize("administrador"), async (req, res) => {
  try {
    const name = req.body.name;
    const contactName = req.body.contact_name ?? req.body.contactName;
    const phone = req.body.phone;
    const email = req.body.email;
    const category = req.body.category;
    const serviceDescription = req.body.service_description ?? req.body.serviceDescription;
    const { rows } = await query(
      `INSERT INTO supplier_catalog (name, contact_name, phone, email, category, service_description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, contactName, phone, email, category, serviceDescription]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", authorize("administrador"), async (req, res) => {
  try {
    const name = req.body.name;
    const contactName = req.body.contact_name ?? req.body.contactName;
    const phone = req.body.phone;
    const email = req.body.email;
    const category = req.body.category;
    const serviceDescription = req.body.service_description ?? req.body.serviceDescription;
    const { rows } = await query(
      `UPDATE supplier_catalog SET name=$1, contact_name=$2, phone=$3, email=$4, category=$5, service_description=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, contactName, phone, email, category, serviceDescription, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    await query("DELETE FROM supplier_catalog WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
