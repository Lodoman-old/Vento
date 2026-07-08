-- Vento - Datos de prueba
-- ========================

-- Password: admin123
INSERT INTO users (display_name, email, password_hash, role) VALUES
('Admin Vento', 'admin@vento.app', '$2b$10$.Inf.R9PbzP97oyHH394CekfiyNn.UZ0BoMgmywj19HFwDUeuhAGi', 'administrador'),
('Carlos Staff', 'carlos@vento.app', '$2b$10$.Inf.R9PbzP97oyHH394CekfiyNn.UZ0BoMgmywj19HFwDUeuhAGi', 'staff'),
('Maria Staff', 'maria@vento.app', '$2b$10$.Inf.R9PbzP97oyHH394CekfiyNn.UZ0BoMgmywj19HFwDUeuhAGi', 'staff'),
('Pedro Cliente', 'pedro@email.com', '$2b$10$.Inf.R9PbzP97oyHH394CekfiyNn.UZ0BoMgmywj19HFwDUeuhAGi', 'cliente')
ON CONFLICT (email) DO NOTHING;

-- Eventos de prueba
INSERT INTO events (name, description, date, venue, total_budget, status, created_by, client_id) VALUES
('Boda Maria & Jose', 'Boda en la hacienda con 150 invitados. Ceremonia civil y recepcion.', '2026-09-15 17:00:00-06', 'Hacienda Los Sauces, Morelia', 250000.00, 'activo',
  (SELECT id FROM users WHERE email = 'admin@vento.app'),
  (SELECT id FROM users WHERE email = 'pedro@email.com')),
('XV de Valeria', 'Fiesta de quince anos con tematica de gala. 200 invitados.', '2026-10-20 19:00:00-06', 'Salon Diamante, Ciudad de Mexico', 180000.00, 'activo',
  (SELECT id FROM users WHERE email = 'admin@vento.app'), NULL),
('Corporativo Fin de Ano', 'Evento empresarial para 300 empleados. Cena baile y reconocimientos.', '2026-12-15 20:00:00-06', 'Centro de Convenciones, Queretaro', 450000.00, 'borrador',
  (SELECT id FROM users WHERE email = 'admin@vento.app'), NULL);

-- Asignar staff a eventos
INSERT INTO event_staff (event_id, user_id)
SELECT e.id, u.id FROM events e, users u
WHERE u.email = 'carlos@vento.app' AND e.name = 'Boda Maria & Jose';

INSERT INTO event_staff (event_id, user_id)
SELECT e.id, u.id FROM events e, users u
WHERE u.email = 'maria@vento.app' AND e.name = 'Boda Maria & Jose';

INSERT INTO event_staff (event_id, user_id)
SELECT e.id, u.id FROM events e, users u
WHERE u.email = 'carlos@vento.app' AND e.name = 'XV de Valeria';

-- Agenda items para "Boda Maria & Jose"
DO $$
DECLARE
  v_event_id UUID;
  v_staff1 UUID;
  v_staff2 UUID;
BEGIN
  SELECT id INTO v_event_id FROM events WHERE name = 'Boda Maria & Jose';
  SELECT id INTO v_staff1 FROM users WHERE email = 'carlos@vento.app';
  SELECT id INTO v_staff2 FROM users WHERE email = 'maria@vento.app';

  INSERT INTO agenda_items (event_id, title, description, start_time, end_time, assigned_to, category, sort_order) VALUES
  (v_event_id, 'Llegada del staff de montaje', 'Meseros y personal de logistica llegan para montar mesas y sillas',
    '2026-09-15 12:00:00-06', '2026-09-15 14:00:00-06', v_staff1, 'logistica', 1),
  (v_event_id, 'Montaje de mesas y decoracion floral', 'Colocar manteleria, centros de mesa y arreglos florales',
    '2026-09-15 13:00:00-06', '2026-09-15 16:00:00-06', v_staff2, 'decoracion', 2),
  (v_event_id, 'Llegada del proveedor de catering', 'Buffet internacional 3 tiempos. Revisar montaje de estaciones.',
    '2026-09-15 14:00:00-06', '2026-09-15 15:00:00-06', v_staff1, 'comida', 3),
  (v_event_id, 'Prueba de sonido e iluminacion', 'Verificar microfonos, bocinas y luces LED ambiente',
    '2026-09-15 15:00:00-06', '2026-09-15 16:30:00-06', v_staff2, 'musica', 4),
  (v_event_id, 'Llegada de invitados', 'Recepcion con bienvenida y coctel de bienvenida',
    '2026-09-15 17:00:00-06', '2026-09-15 18:00:00-06', NULL, 'ceremonia', 5),
  (v_event_id, 'Ceremonia civil', 'Ceremonia oficial con juez',
    '2026-09-15 18:00:00-06', '2026-09-15 19:00:00-06', NULL, 'ceremonia', 6),
  (v_event_id, 'Cena buffet', 'Servicio de buffet internacional 3 tiempos',
    '2026-09-15 19:30:00-06', '2026-09-15 21:00:00-06', v_staff1, 'comida', 7),
  (v_event_id, 'Baile principal', 'Primer baile de los novios + pista abierta',
    '2026-09-15 21:00:00-06', '2026-09-15 23:00:00-06', NULL, 'musica', 8),
  (v_event_id, 'Corte de pastel y brindis', 'Pastel de 3 pisos, champan y fotos',
    '2026-09-15 23:00:00-06', '2026-09-15 23:30:00-06', v_staff2, 'comida', 9),
  (v_event_id, 'Inicio de desmontaje', 'Recoger equipo, limpieza basica del salon',
    '2026-09-16 00:00:00-06', '2026-09-16 02:00:00-06', v_staff1, 'logistica', 10);

  -- Proveedores para "Boda Maria & Jose"
  INSERT INTO suppliers (event_id, name, contact_name, phone, email, category, service_description, contract_status, budget_amount, arrival_time) VALUES
  (v_event_id, 'Catering La Huerta', 'Roberto Mendez', '5544332211', 'roberto@huerta.com', 'catering',
    'Buffet internacional 3 tiempos para 150 pax. Incluye montaje y servicio.',
    'contratado', 95000.00, '2026-09-15 14:00:00-06'),
  (v_event_id, 'Sonido e Iluminacion ProSound', 'Luis Fernandez', '5599887766', 'luis@prosound.com', 'musica',
    'Sistema de sonido 2 bocinas, 4 microfonos, iluminacion LED ambiente.',
    'contratado', 28000.00, '2026-09-15 15:00:00-06'),
  (v_event_id, 'Floreria El Jardin', 'Ana Maria Torres', '5577665544', 'ana@jardin.com', 'decoracion',
    'Centros de mesa florales (15), ramo de novia, arco floral para ceremonia.',
    'contactado', 18500.00, '2026-09-15 13:00:00-06'),
  (v_event_id, 'Fotografia Memorias Eternas', 'Diego Ramirez', '5511223344', 'diego@memorias.com', 'fotografia',
    'Cobertura completa: ceremonia, recepcion, sesion de novios. 8h de servicio.',
    'contratado', 22000.00, '2026-09-15 16:00:00-06'),
  (v_event_id, 'Transporte Ejecutivo VIP', 'Carlos Soto', '5544556677', 'carlos@vip.com', 'transporte',
    'Traslado de invitados: 2 camionetas executive. Novios en Mercedes Clase S.',
    'pendiente', 15000.00, NULL);

  -- Cotizacion de ejemplo
  INSERT INTO quotes (event_id, client_name, client_phone, total, status, created_by)
  VALUES (v_event_id, 'Pedro Martinez', '521234567890', 156800.00, 'enviado',
    (SELECT id FROM users WHERE email = 'admin@vento.app'));

  INSERT INTO quote_items (quote_id, item_name, quantity, unit_price)
  SELECT id, 'Silla Tiffany Dorada', 150, 45.00 FROM quotes WHERE event_id = v_event_id AND client_name = 'Pedro Martinez'
  UNION ALL
  SELECT id, 'Mesa Redonda 1.80m', 15, 150.00 FROM quotes WHERE event_id = v_event_id AND client_name = 'Pedro Martinez'
  UNION ALL
  SELECT id, 'Mantel Satin Blanco x metro', 60, 120.00 FROM quotes WHERE event_id = v_event_id AND client_name = 'Pedro Martinez'
  UNION ALL
  SELECT id, 'Buffet Internacional 3 tiempos', 150, 380.00 FROM quotes WHERE event_id = v_event_id AND client_name = 'Pedro Martinez'
  UNION ALL
  SELECT id, 'Barra Libre Premium 6h', 100, 550.00 FROM quotes WHERE event_id = v_event_id AND client_name = 'Pedro Martinez'
  UNION ALL
  SELECT id, 'Centro de Mesa Floral', 15, 600.00 FROM quotes WHERE event_id = v_event_id AND client_name = 'Pedro Martinez';

END $$;
