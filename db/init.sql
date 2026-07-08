-- Vento - Esquema de Base de Datos
-- ===================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tipos enumerados (español)
CREATE TYPE user_role AS ENUM ('administrador', 'staff', 'cliente');
CREATE TYPE event_status AS ENUM ('borrador', 'activo', 'completado', 'cancelado');
CREATE TYPE agenda_category AS ENUM ('logistica', 'ceremonia', 'comida', 'musica', 'decoracion', 'otro');
CREATE TYPE supplier_category AS ENUM ('catering', 'decoracion', 'musica', 'fotografia', 'transporte', 'otro');
CREATE TYPE contract_status AS ENUM ('pendiente', 'contactado', 'contratado', 'cancelado');
CREATE TYPE quote_status AS ENUM ('borrador', 'enviado', 'aceptado', 'rechazado');

-- 1. Usuarios
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name    VARCHAR(120) NOT NULL,
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20),
    username        VARCHAR(100) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'staff',
    photo_url       TEXT,
    fcm_token       TEXT,
    is_active       BOOLEAN DEFAULT true,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Eventos
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    date            TIMESTAMPTZ NOT NULL,
    venue           VARCHAR(300),
    total_budget    DECIMAL(12,2) DEFAULT 0,
    status          event_status DEFAULT 'borrador',
    created_by      UUID REFERENCES users(id),
    client_id       UUID REFERENCES users(id),
    cover_image     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Relacion Staff <-> Evento
CREATE TABLE event_staff (
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, user_id)
);

-- 4. Agenda
CREATE TABLE agenda_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    assigned_to     UUID REFERENCES users(id),
    category        agenda_category DEFAULT 'otro',
    is_completed    BOOLEAN DEFAULT false,
    completed_at    TIMESTAMPTZ,
    notes           TEXT,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agenda_event ON agenda_items(event_id);
CREATE INDEX idx_agenda_assigned ON agenda_items(assigned_to);

-- 5. Catalogo global de proveedores
CREATE TABLE supplier_catalog (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    contact_name        VARCHAR(120),
    phone               VARCHAR(20),
    email               VARCHAR(255),
    category            supplier_category DEFAULT 'otro',
    service_description TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 5b. Proveedores asignados a eventos
CREATE TABLE event_suppliers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    supplier_id         UUID REFERENCES supplier_catalog(id) ON DELETE CASCADE NOT NULL,
    contract_status     contract_status DEFAULT 'pendiente',
    budget_amount       DECIMAL(12,2) DEFAULT 0,
    paid_amount         DECIMAL(12,2) DEFAULT 0,
    arrival_time        TIMESTAMPTZ,
    actual_arrival_time TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, supplier_id)
);

CREATE INDEX idx_event_suppliers_event ON event_suppliers(event_id);
CREATE INDEX idx_event_suppliers_supplier ON event_suppliers(supplier_id);

-- 6. Catalogo de productos/servicios
CREATE TABLE catalog_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(100) NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    unit_type       VARCHAR(50) DEFAULT 'pieza',
    description     TEXT,
    image_url       TEXT,
    stock_available INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Cotizaciones
CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    client_name     VARCHAR(200),
    client_phone    VARCHAR(20),
    total           DECIMAL(12,2) DEFAULT 0,
    status          quote_status DEFAULT 'borrador',
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quote_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id    UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
    item_name   VARCHAR(200) NOT NULL,
    quantity    INT NOT NULL DEFAULT 1,
    unit_price       DECIMAL(10,2) NOT NULL,
    subtotal         DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    is_supplier_cost BOOLEAN NOT NULL DEFAULT FALSE
);

-- 8a. Checklist pre-evento
CREATE TABLE checklist_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    title       VARCHAR(300) NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8b. Pagos / anticipos
CREATE TABLE payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id    UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
    amount      DECIMAL(12,2) NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE,
    method      VARCHAR(50) DEFAULT 'efectivo',
    reference   VARCHAR(100),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Notificaciones (log interno)
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    type        VARCHAR(50),
    is_read     BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);

-- 9. Configuracion de la empresa
CREATE TABLE company_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name    VARCHAR(255) NOT NULL DEFAULT 'Mi Empresa',
    logo_url        TEXT,
    address         TEXT,
    phone           VARCHAR(20),
    email           VARCHAR(255),
    tax_id          VARCHAR(50),
    quote_footer    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO company_settings (company_name) VALUES ('Mi Empresa de Eventos');

-- 10. Trigger para notificar cambios en agenda
CREATE OR REPLACE FUNCTION notify_agenda_change()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'agenda_channel',
        json_build_object(
            'event_id', COALESCE(NEW.event_id, OLD.event_id),
            'agenda_id', COALESCE(NEW.id, OLD.id),
            'action', TG_OP
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agenda_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON agenda_items
    FOR EACH ROW EXECUTE FUNCTION notify_agenda_change();

-- 10. Trigger para notificar cambios en event_suppliers
CREATE OR REPLACE FUNCTION notify_event_supplier_change()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'supplier_channel',
        json_build_object(
            'event_id', COALESCE(NEW.event_id, OLD.event_id),
            'supplier_id', COALESCE(NEW.supplier_id, OLD.supplier_id),
            'action', TG_OP
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_supplier_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON event_suppliers
    FOR EACH ROW EXECUTE FUNCTION notify_event_supplier_change();

-- Seed: Usuario administrador por defecto (password: admin123)
INSERT INTO users (id, display_name, email, password_hash, role) VALUES
('cf81027d-ec43-46a7-ab3c-f43938f30517', 'Admin Vento', 'admin@vento.app', '$2b$10$.Inf.R9PbzP97oyHH394CekfiyNn.UZ0BoMgmywj19HFwDUeuhAGi', 'administrador');

-- Seed: Usuarios staff (password: admin123)
INSERT INTO users (id, display_name, email, password_hash, role) VALUES
('07b20221-1e44-4af7-a50e-421622360392', 'Carlos Staff', 'carlos@vento.app', '$2b$10$.Inf.R9PbzP97oyHH394CekfiyNn.UZ0BoMgmywj19HFwDUeuhAGi', 'staff'),
('462cbe78-8c74-4197-a094-13cb72ed861c', 'Maria Staff', 'maria@vento.app', '$2b$10$.Inf.R9PbzP97oyHH394CekfiyNn.UZ0BoMgmywj19HFwDUeuhAGi', 'staff');

-- Seed: Usuario cliente (password: admin123)
INSERT INTO users (id, display_name, email, password_hash, role, is_active) VALUES
('9f53d987-550a-47cd-95b2-7669b1bfa75a', 'Pedro Cliente', 'pedro@email.com', '$2b$10$.Inf.R9PbzP97oyHH394CekfiyNn.UZ0BoMgmywj19HFwDUeuhAGi', 'cliente', true);

-- Seed: Eventos de ejemplo
INSERT INTO events (id, name, description, date, venue, total_budget, status, created_by, client_id) VALUES
('f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Boda Maria & Jose', 'Boda en la hacienda con 150 invitados. Ceremonia civil y recepcion.', '2026-09-15 18:00:00-05', 'Hacienda Los Sauces, Morelia', 250000.00, 'activo', 'cf81027d-ec43-46a7-ab3c-f43938f30517', '9f53d987-550a-47cd-95b2-7669b1bfa75a'),
('ed745946-8aa0-494a-ad86-bd707cbe165c', 'XV de Valeria', 'Fiesta de quince anos con tematica de gala. 200 invitados.', '2026-10-20 20:00:00-05', 'Salon Diamante, Ciudad de Mexico', 180000.00, 'activo', 'cf81027d-ec43-46a7-ab3c-f43938f30517', NULL),
('4240297e-430a-4d99-ba7d-e1208978a608', 'Corporativo Fin de Ano', 'Evento empresarial para 300 empleados. Cena baile y reconocimientos.', '2026-12-15 20:00:00-06', 'Centro de Convenciones, Queretaro', 450000.00, 'borrador', 'cf81027d-ec43-46a7-ab3c-f43938f30517', NULL);

-- Seed: Asignacion de staff a eventos
INSERT INTO event_staff (event_id, user_id) VALUES
('f10f9bc6-d578-492c-af1b-ba1ea060d615', '07b20221-1e44-4af7-a50e-421622360392'),
('f10f9bc6-d578-492c-af1b-ba1ea060d615', '462cbe78-8c74-4197-a094-13cb72ed861c'),
('ed745946-8aa0-494a-ad86-bd707cbe165c', '07b20221-1e44-4af7-a50e-421622360392');

-- Seed: Agenda de la Boda Maria & Jose
INSERT INTO agenda_items (id, event_id, title, description, start_time, end_time, sort_order, assigned_to, category) VALUES
('a1000001-0000-4000-8000-000000000001', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Llegada del staff de montaje', 'Meseros y personal de logistica llegan para montar mesas y sillas', '2026-09-15 13:00:00-05', '2026-09-15 15:00:00-05', 1, '07b20221-1e44-4af7-a50e-421622360392', 'logistica'),
('a1000001-0000-4000-8000-000000000002', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Montaje de mesas y decoracion floral', 'Colocar manteleria, centros de mesa y arreglos florales', '2026-09-15 14:00:00-05', '2026-09-15 17:00:00-05', 2, '462cbe78-8c74-4197-a094-13cb72ed861c', 'decoracion'),
('a1000001-0000-4000-8000-000000000003', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Llegada del proveedor de catering', 'Buffet internacional 3 tiempos. Revisar montaje de estaciones.', '2026-09-15 15:00:00-05', '2026-09-15 16:00:00-05', 3, '07b20221-1e44-4af7-a50e-421622360392', 'comida'),
('a1000001-0000-4000-8000-000000000004', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Prueba de sonido e iluminacion', 'Verificar microfonos, bocinas y luces LED ambiente', '2026-09-15 16:00:00-05', '2026-09-15 17:30:00-05', 4, '462cbe78-8c74-4197-a094-13cb72ed861c', 'musica'),
('a1000001-0000-4000-8000-000000000005', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Llegada de invitados', 'Recepcion con bienvenida y coctel de bienvenida', '2026-09-15 18:00:00-05', '2026-09-15 19:00:00-05', 5, NULL, 'ceremonia'),
('a1000001-0000-4000-8000-000000000006', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Ceremonia civil', 'Ceremonia oficial con juez', '2026-09-15 19:00:00-05', '2026-09-15 20:00:00-05', 6, NULL, 'ceremonia'),
('a1000001-0000-4000-8000-000000000007', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Cena buffet', 'Servicio de buffet internacional 3 tiempos', '2026-09-15 20:30:00-05', '2026-09-15 22:00:00-05', 7, '07b20221-1e44-4af7-a50e-421622360392', 'comida'),
('a1000001-0000-4000-8000-000000000008', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Baile principal', 'Primer baile de los novios + pista abierta', '2026-09-15 22:00:00-05', '2026-09-16 00:00:00-05', 8, NULL, 'musica'),
('a1000001-0000-4000-8000-000000000009', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Corte de pastel y brindis', 'Pastel de 3 pisos, champan y fotos', '2026-09-16 00:00:00-05', '2026-09-16 00:30:00-05', 9, '462cbe78-8c74-4197-a094-13cb72ed861c', 'comida'),
('a1000001-0000-4000-8000-000000000010', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Inicio de desmontaje', 'Recoger equipo, limpieza basica del salon', '2026-09-16 01:00:00-05', '2026-09-16 03:00:00-05', 10, '07b20221-1e44-4af7-a50e-421622360392', 'logistica');

-- Seed: Catalogo de proveedores
INSERT INTO supplier_catalog (id, name, contact_name, phone, email, category, service_description) VALUES
('b0000001-0000-4000-8000-000000000001', 'Catering La Huerta', 'Roberto Mendez', '5544332211', 'roberto@huerta.com', 'catering', 'Buffet, cena formal y coffee break'),
('b0000001-0000-4000-8000-000000000002', 'Floreria El Jardin', 'Ana Maria Torres', '5577665544', 'ana@jardin.com', 'decoracion', 'Arreglos florales y centros de mesa'),
('b0000001-0000-4000-8000-000000000003', 'Sonido e Iluminacion ProSound', 'Luis Fernandez', '5599887766', 'luis@prosound.com', 'musica', 'Sonido, iluminacion y DJ'),
('b0000001-0000-4000-8000-000000000004', 'Fotografia Memorias Eternas', 'Diego Ramirez', '5511223344', 'diego@memorias.com', 'fotografia', 'Foto y video profesional'),
('b0000001-0000-4000-8000-000000000005', 'Transporte Ejecutivo VIP', 'Carlos Soto', '5544556677', 'carlos@vip.com', 'transporte', 'Transporte de invitados y novios'),
('b0000001-0000-4000-8000-000000000006', 'Inflables el Guero', 'Oscar Lopez', '1111111111', 'oscar@guero.com', 'otro', 'Inflables y juegos infantiles');

-- Seed: Proveedores asignados a la Boda
INSERT INTO event_suppliers (id, event_id, supplier_id, contract_status, budget_amount, arrival_time) VALUES
('c0000001-0000-4000-8000-000000000001', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'b0000001-0000-4000-8000-000000000001', 'contratado', 95000.00, '2026-09-15 15:00:00-05'),
('c0000001-0000-4000-8000-000000000002', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'b0000001-0000-4000-8000-000000000002', 'contratado', 18500.00, '2026-09-15 14:00:00-05'),
('c0000001-0000-4000-8000-000000000003', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'b0000001-0000-4000-8000-000000000003', 'contratado', 28000.00, '2026-09-15 16:00:00-05'),
('c0000001-0000-4000-8000-000000000004', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'b0000001-0000-4000-8000-000000000004', 'contratado', 22000.00, '2026-09-15 17:00:00-05'),
('c0000001-0000-4000-8000-000000000005', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'b0000001-0000-4000-8000-000000000005', 'contactado', 15000.00, NULL),
('c0000001-0000-4000-8000-000000000006', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'b0000001-0000-4000-8000-000000000006', 'contactado', 10000.00, '2026-09-15 16:00:00-05');

-- Seed: Cotizacion de ejemplo
INSERT INTO quotes (id, event_id, client_name, client_phone, total, status) VALUES
('d0000001-0000-4000-8000-000000000001', 'f10f9bc6-d578-492c-af1b-ba1ea060d615', 'Pedro Martinez', '521234567890', 156800.00, 'enviado');

INSERT INTO quote_items (quote_id, item_name, quantity, unit_price) VALUES
('d0000001-0000-4000-8000-000000000001', 'Silla Tiffany Dorada', 150, 45.00),
('d0000001-0000-4000-8000-000000000001', 'Mesa Redonda 1.80m', 15, 150.00),
('d0000001-0000-4000-8000-000000000001', 'Mantel Satin Blanco x metro', 60, 120.00),
('d0000001-0000-4000-8000-000000000001', 'Centro de Mesa Floral', 15, 600.00),
('d0000001-0000-4000-8000-000000000001', 'Buffet Internacional 3 tiempos', 150, 380.00),
('d0000001-0000-4000-8000-000000000001', 'Barra Libre Premium 6h', 100, 550.00);

-- Seed: Catalogo de ejemplo (todo en español)
INSERT INTO catalog_items (name, category, unit_price, unit_type, image_url) VALUES
('Silla Tiffany Dorada', 'sillas', 45.00, 'pieza', '/uploads/catalog/sillas.svg'),
('Silla Tiffany Blanca', 'sillas', 45.00, 'pieza', '/uploads/catalog/sillas.svg'),
('Silla Tiffany Negra', 'sillas', 48.00, 'pieza', '/uploads/catalog/sillas.svg'),
('Silla Tiffany Champán', 'sillas', 48.00, 'pieza', '/uploads/catalog/sillas.svg'),
('Silla de Madera Clásica', 'sillas', 35.00, 'pieza', '/uploads/catalog/sillas.svg'),
('Funda para Silla Tiffany', 'sillas', 12.00, 'pieza', '/uploads/catalog/sillas.svg'),
('Mesa Redonda 1.80m', 'mesas', 150.00, 'pieza', '/uploads/catalog/mesas.svg'),
('Mesa Redonda 1.50m', 'mesas', 130.00, 'pieza', '/uploads/catalog/mesas.svg'),
('Mesa Rectangular 2.40m', 'mesas', 180.00, 'pieza', '/uploads/catalog/mesas.svg'),
('Mesa Rectangular 1.80m', 'mesas', 160.00, 'pieza', '/uploads/catalog/mesas.svg'),
('Mesa Cuadrada 1.20m', 'mesas', 110.00, 'pieza', '/uploads/catalog/mesas.svg'),
('Mesa Cocktail Alta 1.10m', 'mesas', 90.00, 'pieza', '/uploads/catalog/mesas.svg'),
('Mantel Satin Blanco x metro', 'manteleria', 120.00, 'metro', '/uploads/catalog/manteleria.svg'),
('Mantel Satin Champagne x metro', 'manteleria', 120.00, 'metro', '/uploads/catalog/manteleria.svg'),
('Mantel Satin Negro x metro', 'manteleria', 120.00, 'metro', '/uploads/catalog/manteleria.svg'),
('Mantel Algodón Blanco x metro', 'manteleria', 90.00, 'metro', '/uploads/catalog/manteleria.svg'),
('Sobremantel Organza x metro', 'manteleria', 60.00, 'metro', '/uploads/catalog/manteleria.svg'),
('Cubremantel Encaje x pieza', 'manteleria', 200.00, 'pieza', '/uploads/catalog/manteleria.svg'),
('Plato Loza Blanco 30cm', 'loza', 15.00, 'pieza', '/uploads/catalog/loza.svg'),
('Plato Loza Blanco 25cm', 'loza', 12.00, 'pieza', '/uploads/catalog/loza.svg'),
('Plato Loza Blanco 20cm (postre)', 'loza', 10.00, 'pieza', '/uploads/catalog/loza.svg'),
('Plato Cuadrado Pizarra 30cm', 'loza', 22.00, 'pieza', '/uploads/catalog/loza.svg'),
('Copa Cristal Agua', 'loza', 8.00, 'pieza', '/uploads/catalog/loza.svg'),
('Copa Cristal Vino Tinto', 'loza', 10.00, 'pieza', '/uploads/catalog/loza.svg'),
('Copa Cristal Vino Blanco', 'loza', 10.00, 'pieza', '/uploads/catalog/loza.svg'),
('Copa Cristal Flute (Brindis)', 'loza', 9.00, 'pieza', '/uploads/catalog/loza.svg'),
('Vaso Highball 400ml', 'loza', 5.00, 'pieza', '/uploads/catalog/loza.svg'),
('Vaso Lowball 300ml', 'loza', 5.00, 'pieza', '/uploads/catalog/loza.svg'),
('Cubierto Acero Inoxidable (juego 5 piezas)', 'loza', 8.00, 'juego', '/uploads/catalog/loza.svg'),
('Tenedor Postre', 'loza', 2.00, 'pieza', '/uploads/catalog/loza.svg'),
('Cuchara Sopera', 'loza', 2.50, 'pieza', '/uploads/catalog/loza.svg'),
('Cuchillo Filete', 'loza', 3.00, 'pieza', '/uploads/catalog/loza.svg'),
('Servilleta Tela Blanca 50x50', 'loza', 6.00, 'pieza', '/uploads/catalog/loza.svg'),
('Porta Servilleta Acrílico', 'loza', 4.00, 'pieza', '/uploads/catalog/loza.svg'),
('Buffet BBQ Carne + Guarniciones', 'comida', 250.00, 'persona', '/uploads/catalog/comida.svg'),
('Buffet Internacional 3 tiempos', 'comida', 380.00, 'persona', '/uploads/catalog/comida.svg'),
('Buffet Mexicano (Tacos, Pozole, Tamales)', 'comida', 320.00, 'persona', '/uploads/catalog/comida.svg'),
('Buffet Italiano (Pastas, Ensaladas)', 'comida', 290.00, 'persona', '/uploads/catalog/comida.svg'),
('Coffee Break Básico x persona', 'comida', 95.00, 'persona', '/uploads/catalog/comida.svg'),
('Coffee Break Premium x persona', 'comida', 150.00, 'persona', '/uploads/catalog/comida.svg'),
('Cena Formal 4 tiempos x persona', 'comida', 550.00, 'persona', '/uploads/catalog/comida.svg'),
('Lunch Ejecutivo x persona', 'comida', 180.00, 'persona', '/uploads/catalog/comida.svg'),
('Estación de Quesos y Vinos', 'comida', 280.00, 'persona', '/uploads/catalog/comida.svg'),
('Barra Libre Básica 4h', 'bebida', 350.00, 'persona', '/uploads/catalog/bebida.svg'),
('Barra Libre Premium 6h', 'bebida', 550.00, 'persona', '/uploads/catalog/bebida.svg'),
('Barra de Cerveza Artesanal 4h', 'bebida', 280.00, 'persona', '/uploads/catalog/bebida.svg'),
('Barra de Coctelería 4h', 'bebida', 450.00, 'persona', '/uploads/catalog/bebida.svg'),
('Vinos Tinto / Blanco por botella', 'bebida', 350.00, 'pieza', '/uploads/catalog/bebida.svg'),
('Champán / Espumoso por botella', 'bebida', 600.00, 'pieza', '/uploads/catalog/bebida.svg'),
('Agua Embotellada 600ml', 'bebida', 20.00, 'pieza', '/uploads/catalog/bebida.svg'),
('Refresco Lata 355ml', 'bebida', 25.00, 'pieza', '/uploads/catalog/bebida.svg'),
('Centro de Mesa Floral Grande', 'decoracion', 600.00, 'pieza', '/uploads/catalog/decoracion.svg'),
('Centro de Mesa Floral Chico', 'decoracion', 350.00, 'pieza', '/uploads/catalog/decoracion.svg'),
('Arreglo Floral para Ceremonia', 'decoracion', 1500.00, 'pieza', '/uploads/catalog/decoracion.svg'),
('Globos Arco Neon (arco)', 'decoracion', 1200.00, 'pieza', '/uploads/catalog/decoracion.svg'),
('Globos Columna (2m)', 'decoracion', 800.00, 'pieza', '/uploads/catalog/decoracion.svg'),
('Globos Centro de Mesa (3 globos)', 'decoracion', 180.00, 'pieza', '/uploads/catalog/decoracion.svg'),
('Pista de Baile LED 3x3m', 'decoracion', 4500.00, 'juego', '/uploads/catalog/decoracion.svg'),
('Pista de Baile Madera 3x3m', 'decoracion', 2500.00, 'juego', '/uploads/catalog/decoracion.svg'),
('Photobooth Marco Floral', 'decoracion', 3500.00, 'juego', '/uploads/catalog/decoracion.svg'),
('Photobooth Fondo LED', 'decoracion', 4000.00, 'juego', '/uploads/catalog/decoracion.svg'),
('Letrero 3D \"Love\" Iluminado', 'decoracion', 2800.00, 'pieza', '/uploads/catalog/decoracion.svg'),
('Letrero 3D Iniciales 1.5m', 'decoracion', 2200.00, 'pieza', '/uploads/catalog/decoracion.svg'),
('Velas Flotantes x 10', 'decoracion', 150.00, 'juego', '/uploads/catalog/decoracion.svg'),
('Camino de Mesa Pétalos x metro', 'decoracion', 80.00, 'metro', '/uploads/catalog/decoracion.svg'),
('Sonido Básico (2 bocinas + micrófono)', 'sonido', 3000.00, 'juego', '/uploads/catalog/sonido.svg'),
('Sonido Premium (4 bocinas + mezcladora)', 'sonido', 5500.00, 'juego', '/uploads/catalog/sonido.svg'),
('Iluminación LED Ambiente', 'sonido', 2500.00, 'juego', '/uploads/catalog/sonido.svg'),
('Iluminación LED Pantallas 5m', 'sonido', 4000.00, 'juego', '/uploads/catalog/sonido.svg'),
('Pantalla LED 65" con soporte', 'sonido', 2000.00, 'pieza', '/uploads/catalog/sonido.svg'),
('Proyector 4K + Pantalla 3m', 'sonido', 2500.00, 'juego', '/uploads/catalog/sonido.svg'),
('DJ 4h con equipo', 'sonido', 6000.00, 'juego', '/uploads/catalog/sonido.svg'),
('Mariachi 10 músicos (hora)', 'sonido', 8000.00, 'juego', '/uploads/catalog/sonido.svg'),
('Grupo Musical 5 integrantes (hora)', 'sonido', 12000.00, 'juego', '/uploads/catalog/sonido.svg');
