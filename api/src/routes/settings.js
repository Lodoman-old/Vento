import { Router } from "express";
import { query } from "../services/db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  try {
      const { rows } = await query("SELECT * FROM company_settings LIMIT 1");
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/", authenticate, authorize("administrador"), async (req, res) => {
  const { company_name, logo_url, address, phone, email, tax_id, quote_footer } = req.body;
  try {
    const { rows } = await query(
      `UPDATE company_settings SET
        company_name = COALESCE($1, company_name),
        logo_url = COALESCE($2, logo_url),
        address = COALESCE($3, address),
        phone = COALESCE($4, phone),
        email = COALESCE($5, email),
        tax_id = COALESCE($6, tax_id),
        quote_footer = COALESCE($7, quote_footer),
        updated_at = NOW()
      WHERE id = (SELECT id FROM company_settings LIMIT 1)
      RETURNING *`,
      [company_name, logo_url, address, phone, email, tax_id, quote_footer]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
