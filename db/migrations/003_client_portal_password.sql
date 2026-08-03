-- Migration: Guardar la contraseña del portal cliente en texto plano
-- para poder mostrarla al organizador sin regenerarla en cada reenvío
-- ===================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain VARCHAR(255);
