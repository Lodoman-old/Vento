# Documento de Diseño Técnico — Vento

> **Versión:** 2.0  
> **Fecha:** Julio 2026  
> **Stack:** React + Node.js + PostgreSQL + Docker  
> **Eslogan:** *"Eventos en perfecta sincronía."*

---

## Índice

1. [Arquitectura de Alto Nivel y Flujo de Datos](#1-arquitectura-de-alto-nivel-y-flujo-de-datos)
2. [Esquema de Base de Datos (PostgreSQL)](#2-esquema-de-base-de-datos-postgresql)
3. [Sistema de Notificaciones en Tiempo Real](#3-sistema-de-notificaciones-en-tiempo-real)
4. [Módulo de Cotizador Express](#4-módulo-de-cotizador-express)
5. [Seguridad y Control de Acceso](#5-seguridad-y-control-de-acceso)
6. [Despliegue e Infraestructura](#6-despliegue-e-infraestructura)

---

## 1. Arquitectura de Alto Nivel y Flujo de Datos

### 1.1 Diagrama de Arquitectura

```mermaid
graph TB
    subgraph "Cliente"
        WEB["Frontend Web (React + Vite)"]
        APP["App Android (Flutter)"]
    end

    subgraph "Servidor (Docker)"
        API["Node.js API (Express/Fastify)"]
        WS["WebSocket Server (Socket.io)"]
        PG["PostgreSQL"]
        REDIS["Redis (pub/sub + sesiones)"]
    end

    subgraph "Servicios Externos"
        FCM["Firebase Cloud Messaging"]
    end

    WEB -->|REST + Socket.io| API
    WEB <-->|WebSocket| WS
    APP -->|REST + Socket.io| API
    APP <-->|WebSocket| WS
    API --> PG
    API --> REDIS
    WS --> REDIS
    API -->|send| FCM
    FCM -->|Push| APP
    REDIS -->|pub/sub| WS
```

### 1.2 Flujo de Datos en Tiempo Real

| Evento | Origen | Mecanismo | Destino |
|---|---|---|---|
| Staff marca tarea completada | App (Flutter) | REST POST → API escribe en PG → NOTIFY → Redis pub → Socket.io emite | Dashboard Web recibe el evento en <200ms |
| Admin actualiza agenda | Dashboard Web | REST PUT → API escribe en PG → NOTIFY → Redis pub → Socket.io emite | App recibe el cambio automáticamente |

**Flujo detallado de un cambio de estatus:**

```mermaid
sequenceDiagram
    participant StaffApp as App (Flutter)
    participant API as Node.js API
    participant PG as PostgreSQL
    participant REDIS as Redis
    participant WS as Socket.io
    participant AdminWeb as Dashboard Web

    StaffApp->>API: PATCH /api/agenda/:id { isCompleted: true }
    API->>PG: UPDATE agenda SET is_completed=true
    API->>PG: NOTIFY agenda_channel, '{"agendaId":"..."}'
    PG-->>API: OK
    API-->>StaffApp: 200 { updated: true }
    API->>WS: io.to(eventRoom).emit("agenda:updated", payload)
    WS-->>AdminWeb: Recibe "agenda:updated" → actualiza UI
    WS-->>StaffApp: Recibe confirmación por socket
```

### 1.3 Consistencia en Tiempo Real

La combinación de **Postgres LISTEN/NOTIFY** + **Redis pub/sub** + **Socket.io rooms** garantiza:

- Las escrituras van a PostgreSQL (fuente de verdad).
- Triggers en PG emiten NOTIFY por canal (`agenda_channel`, `supplier_channel`).
- El API escucha esos canales y publica en Redis pub/sub.
- Socket.io suscrito a Redis reenvía a los clients conectados a la sala del evento.
- Si un cliente se desconecta, al reconectarse pide el estado actual via REST.

---

## 2. Esquema de Base de Datos (PostgreSQL)

### 2.1 Modelo Relacional

```sql
-- Esquema completo de Vento

-- ==============================
-- 1. USUARIOS
-- ==============================
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'client');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name    VARCHAR(120) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'staff',
    photo_url       TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- 2. EVENTOS
-- ==============================
CREATE TYPE event_status AS ENUM ('draft', 'active', 'completed', 'cancelled');

CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    date            TIMESTAMPTZ NOT NULL,
    venue           VARCHAR(300),
    total_budget    DECIMAL(12,2) DEFAULT 0,
    status          event_status DEFAULT 'draft',
    created_by      UUID REFERENCES users(id),
    client_id       UUID REFERENCES users(id),
    cover_image     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Relación staff <> eventos (muchos a muchos)
CREATE TABLE event_staff (
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, user_id)
);

-- ==============================
-- 3. AGENDA (ítems del evento)
-- ==============================
CREATE TYPE agenda_category AS ENUM ('logistics', 'ceremony', 'food', 'music', 'other');

CREATE TABLE agenda_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    assigned_to     UUID REFERENCES users(id),
    category        agenda_category DEFAULT 'other',
    is_completed    BOOLEAN DEFAULT false,
    completed_at    TIMESTAMPTZ,
    notes           TEXT,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agenda_event ON agenda_items(event_id);
CREATE INDEX idx_agenda_assigned ON agenda_items(assigned_to);

-- ==============================
-- 4. PROVEEDORES
-- ==============================
CREATE TYPE supplier_category AS ENUM (
    'catering', 'decoration', 'music', 'photography', 'transport', 'other'
);
CREATE TYPE contract_status AS ENUM ('pending', 'contacted', 'hired', 'cancelled');

CREATE TABLE suppliers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    name                VARCHAR(200) NOT NULL,
    contact_name        VARCHAR(120),
    phone               VARCHAR(20),
    email               VARCHAR(255),
    category            supplier_category DEFAULT 'other',
    service_description TEXT,
    contract_status     contract_status DEFAULT 'pending',
    budget_amount       DECIMAL(12,2) DEFAULT 0,
    paid_amount         DECIMAL(12,2) DEFAULT 0,
    arrival_time        TIMESTAMPTZ,
    actual_arrival_time TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- 5. CATÁLOGO DE PRODUCTOS/SERVICIOS
-- ==============================
CREATE TABLE catalog_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(100) NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    unit_type       VARCHAR(50) DEFAULT 'unit',
    description     TEXT,
    image_url       TEXT,
    stock_available INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- 6. COTIZACIONES
-- ==============================
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');

CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    client_phone    VARCHAR(20),
    total           DECIMAL(12,2) DEFAULT 0,
    status          quote_status DEFAULT 'draft',
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
    unit_price  DECIMAL(10,2) NOT NULL,
    subtotal    DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ==============================
-- 7. NOTIFICACIONES (log interno)
-- ==============================
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

-- ==============================
-- TRIGGER: Notificar cambios via LISTEN/NOTIFY
-- ==============================
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
```

### 2.2 Ejemplo de Datos

```json
// agenda_item luego de que staff lo completa
{
  "id": "a1b2c3d4-...",
  "event_id": "e5f6g7h8-...",
  "title": "Llegada de meseros y montaje",
  "is_completed": true,
  "completed_at": "2026-08-15T16:05:00Z",
  "assigned_to": "u9x8y7z6-..."
}
```

**Flujo de sincronización:**

1. App Flutter hace `PATCH /api/agenda/:id { is_completed: true }`
2. API valida que el staff pertenezca al evento, actualiza PostgreSQL
3. Trigger `notify_agenda_change()` ejecuta `pg_notify('agenda_channel', ...)`
4. API escucha el canal y emite via Socket.io a la sala del evento
5. Dashboard Web y App reciben el mensaje y actualizan UI

---

## 3. Sistema de Notificaciones en Tiempo Real

### 3.1 Notificaciones Internas (WebSocket)

Cada evento tiene una **sala de Socket.io**. Los clientes se unen al autenticarse:

```javascript
// Servidor (Node.js + Socket.io)
io.on("connection", (socket) => {
  const userId = socket.handshake.auth.userId;

  socket.on("join:event", (eventId) => {
    // Verificar que el usuario pertenece al evento
    socket.join(`event:${eventId}`);
  });

  socket.on("leave:event", (eventId) => {
    socket.leave(`event:${eventId}`);
  });
});

// Emitir a todos los miembros de un evento
io.to(`event:${eventId}`).emit("agenda:updated", {
  agendaId,
  isCompleted: true,
  updatedBy: userId,
});
```

### 3.2 Notificaciones Push (FCM) — Al final

Se implementa al final del proyecto, cuando la App Android esté lista para recibirlas.

**Arquitectura:**

```mermaid
sequenceDiagram
    participant API as Node.js API
    participant PG as PostgreSQL
    participant FCM as Firebase Cloud Messaging
    participant APP as App Android

    API->>PG: Consulta tokens FCM del staff/admin
    PG-->>API: [token1, token2, ...]
    API->>FCM: sendEachForMulticast(tokens, payload)
    FCM-->>APP: Push notification
```

**Reglas de negocio para push:**

| Condición | Mensaje | Destinatarios |
|---|---|---|
| `agenda.is_completed=true` | "Hito: {title} completado" | Admin + Cliente |
| `supplier.actual_arrival > arrival + 15min` | "Alerta: {name} no ha llegado" | Admin |
| `supplier.contract_status='hired'` | "{name} contratado" | Admin |

```javascript
// api/services/notifications.js
const admin = require("firebase-admin");

// Inicializar Firebase Admin SDK solo para FCM
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

async function sendPushNotification(userIds, title, body, data = {}) {
  // Obtener tokens FCM de los usuarios
  const { rows } = await db.query(
    "SELECT fcm_token FROM users WHERE id = ANY($1) AND fcm_token IS NOT NULL",
    [userIds]
  );

  if (rows.length === 0) return;

  const tokens = rows.map((r) => r.fcm_token);

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    android: { priority: "high" },
    data,
  });
}
```

### 3.3 Tabla de usuarios con FCM Token

Se agrega columna a `users` cuando se implemente push:

```sql
ALTER TABLE users ADD COLUMN fcm_token TEXT;
```

---

## 4. Módulo de Cotizador Express

### 4.1 Flujo de Cotización

```mermaid
graph LR
    CAT[Catálogo en PostgreSQL] --> UI[Web / App muestran grid]
    UI --> SEL[Organizador selecciona items + cantidades]
    SEL --> PREVIEW[Vista previa con total calculado]
    PREVIEW --> SAVE{Guardar}
    SAVE -->|Borrador| DRAFT[quote.status = draft]
    SAVE -->|Descargar PDF| PDF[Generación local en el cliente]
    PDF --> DOWNLOAD[Descarga .pdf]
    PREVIEW --> SHARE[Compartir por wa.me]
```

### 4.2 Catálogo

```sql
INSERT INTO catalog_items (name, category, unit_price, unit_type) VALUES
('Silla Tiffany Dorada', 'sillas', 45.00, 'unit'),
('Mantelería Satin Blanca', 'manteleria', 120.00, 'meter'),
('Plato Loza Blanca 30cm', 'loza', 15.00, 'unit'),
('Buffet BBQ (carne + guarniciones)', 'comida', 250.00, 'pax'),
('Barra Libre Básica (4h)', 'bebida', 350.00, 'pax');
```

### 4.3 Generación de PDF (100% Local)

Se genera en el navegador con **pdfmake** (o en Flutter con **pdf** package). Sin servidor, sin costos.

```javascript
// vento-web/src/lib/generateQuotePdf.js
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts.pdfMake ? pdfMake.pdfMake.vfs : pdfFonts.vfs;

export function generateQuotePdf(quote, eventName) {
  const docDefinition = {
    pageSize: "A4",
    content: [
      { text: "Vento — Cotización", style: "header" },
      { text: `Evento: ${eventName}`, margin: [0, 10, 0, 5] },
      { text: `Fecha: ${new Date().toLocaleDateString()}` },
      { text: "", margin: [0, 10] },
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto"],
          body: [
            ["Item", "Cant.", "P/Unit", "Subtotal"],
            ...quote.items.map((i) => [
              i.item_name,
              i.quantity,
              `$${i.unit_price}`,
              `$${i.quantity * i.unit_price}`,
            ]),
            [
              { text: "Total", colSpan: 3, alignment: "right", bold: true },
              {},
              {},
              { text: `$${quote.total}`, bold: true },
            ],
          ],
        },
      },
    ],
    styles: {
      header: { fontSize: 20, bold: true, alignment: "center", margin: [0, 0, 0, 20] },
    },
  };

  pdfMake.createPdf(docDefinition).download(`Cotizacion_${eventName}.pdf`);
}
```

```dart
// vento_app/lib/services/pdf_service.dart
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart';
import 'package:printing/printing.dart';

Future<void> generateQuotePdf(Quote quote, String eventName) async {
  final pdf = Document();
  pdf.addPage(
    MultiPage(
      build: (context) => [
        Header(level: 0, text: 'Vento — Cotización'),
        Text('Evento: $eventName'),
        Text('Fecha: ${DateTime.now().toLocal()}'),
        SizedBox(height: 20),
        Table.fromTextArray(
          headerStyle: TextStyle(fontWeight: FontWeight.bold),
          headers: ['Item', 'Cant.', 'P/Unit', 'Subtotal'],
          data: quote.items.map((i) => [
            i.itemName,
            i.quantity.toString(),
            '\$${i.unitPrice}',
            '\$${i.subtotal}',
          ]).toList(),
        ),
      ],
    ),
  );
  await Printing.sharePdf(
    bytes: await pdf.save(),
    filename: 'Cotizacion_$eventName.pdf',
  );
}
```

### 4.4 Envío por WhatsApp (Costo $0)

```javascript
// Generar link wa.me con el nombre del evento y total
const message = encodeURIComponent(
  `📄 Cotización para "${eventName}" — Total: $${total}\n\nDescárgala aquí: ${pdfLocalUrl}`
);
const waLink = `https://wa.me/${clientPhone}?text=${message}`;

// El usuario hace clic y se abre WhatsApp
window.open(waLink, "_blank");
```

---

## 5. Seguridad y Control de Acceso

### 5.1 Autenticación (JWT + Bcrypt)

```javascript
// api/middleware/auth.js
const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    next();
  };
}
```

```javascript
// api/routes/auth.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Router } = require("express");

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  if (rows.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token, user: { id: user.id, name: user.display_name, role: user.role } });
});
```

### 5.2 Control de Acceso por Rol

```javascript
// api/middleware/authorize.js

// Admin: acceso total a todo
// Staff: solo puede leer/modificar eventos donde está asignado
// Staff en agenda: solo puede modificar ítems donde assigned_to = su ID
// Staff en suppliers: solo puede actualizar actual_arrival_time y notes

async function belongsToEvent(req, res, next) {
  const eventId = req.params.eventId;
  const { rows } = await db.query(
    "SELECT 1 FROM event_staff WHERE event_id = $1 AND user_id = $2",
    [eventId, req.user.id]
  );
  if (rows.length === 0 && req.user.role !== "admin") {
    return res.status(403).json({ error: "No asignado a este evento" });
  }
  next();
}

async function isAssignedToAgendaItem(req, res, next) {
  const { id } = req.params;
  const { rows } = await db.query(
    "SELECT assigned_to FROM agenda_items WHERE id = $1",
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
  if (rows[0].assigned_to !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "No asignado a esta tarea" });
  }
  next();
}
```

### 5.3 Resumen de Permisos

| Acción | Admin | Staff | Cliente |
|---|---|---|---|
| CRUD eventos | ✅ | ❌ | ❌ |
| Ver evento | ✅ | Solo asignados | Solo propios |
| CRUD agenda | ✅ | ❌ | ❌ |
| Completar tarea agenda | ✅ | Solo su tarea | ❌ |
| CRUD proveedores | ✅ | ❌ | ❌ |
| Reportar llegada proveedor | ✅ | ✅ (solo fecha y notas) | ❌ |
| CRUD cotizaciones | ✅ | ❌ | ✅ (ver) |
| Ver catálogo | ✅ | ✅ | ❌ |
| Dashboard financiero | ✅ | ❌ | ❌ |

---

## 6. Despliegue e Infraestructura

### 6.1 Entorno de Desarrollo

```yaml
# docker-compose.yml (desarrollo)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vento
      POSTGRES_USER: vento
      POSTGRES_PASSWORD: vento_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: ./api
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgres://vento:vento_dev@postgres:5432/vento
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_secret_123
      PORT: 4000
    volumes:
      - ./api:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis

  web:
    build: ./web
    ports:
      - "5173:5173"
    volumes:
      - ./web:/app
      - /app/node_modules
    depends_on:
      - api
```

```bash
# Comandos para arrancar
docker compose up -d          # PostgreSQL + Redis + API
cd vento-web && npm run dev   # Frontend en localhost:5173
cd vento-app && flutter run    # App conectada a localhost:4000
```

### 6.2 Estructura del Proyecto

```
vento/
├── docker-compose.yml
├── api/                    # Backend Node.js
│   ├── Dockerfile
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── index.js
│   └── package.json
├── web/                    # Frontend React
│   ├── Dockerfile
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   └── package.json
├── app/                    # App Flutter (se añade después)
│   └── ...
└── db/
    └── init.sql            # Esquema inicial de BD
```

### 6.3 Producción (Futuro)

La misma estructura Docker se despliega en un VPS con:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Servicios adicionales en producción:
- **Nginx** como reverse proxy + SSL
- **pg_backup** para respaldos automáticos
- **Firebase Admin SDK** solo para FCM (push notifications)

---

## Resumen del Stack

| Capa | Tecnología | Desarrollo | Producción |
|---|---|---|---|
| Frontend Web | React 19 + Vite + Tailwind | `npm run dev` (localhost) | Docker + Nginx |
| App Android | Flutter 3.x | `flutter run` | Play Store |
| API | Node.js + Express/Fastify | Docker (hot reload) | Docker + PM2 |
| Base de Datos | PostgreSQL 16 | Docker | VPS + backups |
| Tiempo Real | Socket.io + Redis | Docker | Docker |
| Cache/Sesiones | Redis | Docker | Docker |
| PDF | pdfmake (cliente) | Local | Local |
| Push Notifications | Firebase Cloud Messaging | No implementado | Al final del proyecto |
| Autenticación | JWT + bcrypt | Local | Local |
| Infraestructura | Docker Compose | Local | VPS (Hosting) |

---

> *"Eventos en perfecta sincronía."* — **Vento**
