# Mora Spa — Instrucciones para Copilot

Monorepo full-stack de **Mora Spa** (Gisela Mora — SPA · BARBER): agenda
digital con tienda, promociones, equipo y reservas con adelanto online.

## Stack

- **apps/api** — Express 4 + Prisma 5 + PostgreSQL (puerto `4000`, prefijo `/api`).
- **apps/web** — Next.js 14 App Router (puerto `3000`).
- **apps/mobile**, **apps/movil** — Flutter (cliente móvil).

## Comandos

| Acción | Comando |
| --- | --- |
| Instalar deps | `npm install` en cada app |
| API en dev | `cd apps/api && npx tsx src/index.ts` |
| Web en dev | `cd apps/web && npm run dev` |
| Prisma migrate | `cd apps/api && npx prisma migrate dev` |
| Prisma seed | `cd apps/api && npx tsx prisma/seed.ts` |

## Variables de entorno (apps/api)

- `DATABASE_URL` — conexión PostgreSQL.
- `JWT_SECRET` — firma de tokens de cliente (8 h).
- `CULQI_PUBLIC_KEY` — tokenización.
- `CULQI_SECRET_KEY` — cargos.

## Pasarela Culqi

- **Tokenización**: el navegador llama al proxy backend
  `POST /api/public/culqi/token` (CORS bloquea el endpoint directo de Culqi).
- **Cargo**: backend hace `POST /v2/charges` con la `CULQI_SECRET_KEY`.
- **Tarjeta de prueba**: `4111 1111 1111 1111`, CVV `123`, exp `12/2030`.

## Rutas de la API

- `/api/public/*` — sin auth (catálogo, login, registro, culqi token).
- `/api/client-auth/*` — auth del cliente (JWT 8 h).
- `/api/client/*` — acciones del cliente autenticado.
- `/api/admin/*` — acciones del personal/admin (requiere rol).

## Convenciones

- TypeScript estricto, evitar `any` en dominio.
- Montos monetarios como `Decimal` o `string` (nunca `number` para dinero).
- Estilo: minimalista, colores solidos elegantes, identidad mascotas (no solo perros).

