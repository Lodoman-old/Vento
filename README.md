# Vento — Eventos en perfecta sincronía

## Stack
- **Frontend Web:** React 19 + Vite + Tailwind CSS
- **Backend API:** Node.js + Express + Socket.io
- **Base de Datos:** PostgreSQL 16
- **Cache/Tiempo Real:** Redis + Socket.io
- **App Móvil:** Flutter (pendiente)

## Requisitos

- Node.js 22+
- PostgreSQL 16
- Redis 7 (opcional, cae en modo degraded)
- Flutter SDK (solo para App)

## Inicio rápido

```bash
# 1. Clonar e instalar dependencias
cd api && npm install
cd ../web && npm install

# 2. Configurar BD (una vez)
cd ../db
.\setup.ps1                  # Windows PS
# O manual: psql -U postgres -d vento -f init.sql
# O manual: psql -U postgres -d vento -f seed.sql

# 3. Copiar .env
cp api/.env.example api/.env  # Ajustar credenciales si es necesario

# 4. Iniciar API
cd api && npm run dev          # http://localhost:4000

# 5. Iniciar Web (otra terminal)
cd web && npm run dev          # http://localhost:5173
```

## Docker (opcional)

```bash
docker compose up -d
```

## Credenciales de prueba

| Email | Password | Rol |
|---|---|---|
| admin@vento.app | admin123 | Admin |
| carlos@vento.app | admin123 | Staff |
| maria@vento.app | admin123 | Staff |
| pedro@email.com | admin123 | Cliente |

## Estructura

```
vento/
├── api/          # Backend Node.js
├── web/          # Frontend React
├── app/          # App Flutter (pendiente)
├── db/           # SQL schema + seeds
└── docker-compose.yml
```
