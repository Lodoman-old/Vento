-- Migration: Event templates + Config columns + Password reset support
-- ===================================

-- 1. Tabla de plantillas para agenda y checklist
CREATE TABLE IF NOT EXISTS event_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_type   VARCHAR(20) NOT NULL CHECK (template_type IN ('agenda', 'checklist')),
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    category        VARCHAR(50) DEFAULT 'logistica',
    hours_from_base DECIMAL(5,2),
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_templates_type ON event_templates(template_type);

-- 2. Columnas de configuracion avanzada en company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS db_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS firebase_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS storage_config JSONB DEFAULT '{}'::jsonb;

-- 3. Seed: Plantilla de agenda por defecto
INSERT INTO event_templates (template_type, title, description, category, hours_from_base, sort_order) VALUES
('agenda', 'Decoración general del salón', 'Globos, letreros, cortinas y ambientación', 'decoracion', -1, 0),
('agenda', 'Montaje de mesas', 'Colocar y alinear todas las mesas según el plano del evento', 'logistica', 1, 1),
('agenda', 'Montaje de sillas', 'Colocar sillas en cada mesa según el número de invitados', 'logistica', 2, 2),
('agenda', 'Colocación de mantelería', 'Poner manteles, cubremanteles y servilletas', 'logistica', 3, 3),
('agenda', 'Montaje de vajilla y cubiertos', 'Colocar platos, cubiertos y copas en cada lugar', 'logistica', 3, 4),
('agenda', 'Centros de mesa y decoración', 'Colocar centros de mesa, velas y adornos', 'decoracion', 3, 5),
('agenda', 'Señalética y bienvenida', 'Colocar letreros de bienvenida, mesas y direccionales', 'logistica', 3.5, 6),
('agenda', 'Revisión general', 'Recorrido final para verificar que todo esté listo', 'logistica', 4, 7);

-- 4. Seed: Plantilla de checklist por defecto
INSERT INTO event_templates (template_type, title, sort_order) VALUES
('checklist', 'Cinchos para mesas', 0),
('checklist', 'Mecate / Cuerda', 1),
('checklist', 'Rafia', 2),
('checklist', 'Martillo', 3),
('checklist', 'Pistola de silicon y barras', 4),
('checklist', 'Tijeras', 5),
('checklist', 'Cinta adhesiva transparente', 6),
('checklist', 'Cinta masking tape', 7),
('checklist', 'Desarmadores', 8),
('checklist', 'Nivel de burbuja', 9),
('checklist', 'Extensión eléctrica', 10),
('checklist', 'Focos / Bombillas extra', 11),
('checklist', 'Linterna', 12),
('checklist', 'Kit de primeros auxilios', 13),
('checklist', 'Botiquín de costura', 14);
