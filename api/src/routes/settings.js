import { Router } from "express";
import { query } from "../services/db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import fs from "fs";
import path from "path";

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
  const { company_name, logo_url, address, phone, email, tax_id, quote_footer, db_config, firebase_config, storage_config } = req.body;
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
        db_config = CASE WHEN $8::jsonb IS NOT NULL AND $8::jsonb != '{}'::jsonb THEN $8::jsonb ELSE db_config END,
        firebase_config = CASE WHEN $9::jsonb IS NOT NULL AND $9::jsonb != '{}'::jsonb THEN $9::jsonb ELSE firebase_config END,
        storage_config = CASE WHEN $10::jsonb IS NOT NULL AND $10::jsonb != '{}'::jsonb THEN $10::jsonb ELSE storage_config END,
        updated_at = NOW()
      WHERE id = (SELECT id FROM company_settings LIMIT 1)
      RETURNING *`,
      [company_name, logo_url, address, phone, email, tax_id, quote_footer,
       db_config ? JSON.stringify(db_config) : null,
       firebase_config ? JSON.stringify(firebase_config) : null,
       storage_config ? JSON.stringify(storage_config) : null]
    );

    // Sync config to .env file if provided
    if (db_config || firebase_config || storage_config) {
      try {
        const envPath = path.join(process.cwd(), ".env");
        let envContent = "";
        try { envContent = fs.readFileSync(envPath, "utf-8"); } catch {}

        function upsertEnv(key, value) {
          if (!value && value !== "") return;
          const regex = new RegExp(`^${key}=.*$`, "m");
          if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
          } else {
            envContent += `\n${key}=${value}`;
          }
        }

        if (db_config) {
          if (db_config.host) upsertEnv("DB_HOST", db_config.host);
          if (db_config.port) upsertEnv("DB_PORT", db_config.port);
          if (db_config.name) upsertEnv("DB_NAME", db_config.name);
          if (db_config.user) upsertEnv("DB_USER", db_config.user);
          if (db_config.password) upsertEnv("DB_PASSWORD", db_config.password);
          if (db_config.url) upsertEnv("DATABASE_URL", db_config.url);
        }

        if (firebase_config) {
          if (firebase_config.service_account) upsertEnv("FCM_SERVICE_ACCOUNT", firebase_config.service_account);
        }

        if (storage_config) {
          if (storage_config.cloud_name) upsertEnv("CLOUDINARY_CLOUD_NAME", storage_config.cloud_name);
          if (storage_config.api_key) upsertEnv("CLOUDINARY_API_KEY", storage_config.api_key);
          if (storage_config.api_secret) upsertEnv("CLOUDINARY_API_SECRET", storage_config.api_secret);
        }

        fs.writeFileSync(envPath, envContent.trim() + "\n");
      } catch (err) {
        console.warn("[settings] No se pudo actualizar .env:", err.message);
      }
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
