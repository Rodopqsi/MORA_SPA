# Guía de Despliegue — Mora Spa

## 1. Variables de entorno

### API (`apps/api/.env`)
```env
# Base de datos
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/mora_spa?schema=public"

# Seguridad
JWT_SECRET="tu-jwt-secret-min-32-caracteres"

# Culqi (pasarela de pagos)
CULQI_PUBLIC_KEY="pk_test_..."
CULQI_SECRET_KEY="sk_test_..."

# CORS (origen de la web en producción)
CORS_ORIGIN="https://tudominio.com"

# Puerto (Render/Railway lo inyectan automáticamente)
PORT=4000
```

### Web (`apps/web/.env.local` en build time)
```env
NEXT_PUBLIC_API_BASE_URL="https://tu-api.com/api"
NEXT_PUBLIC_CULQI_PUBLIC_KEY="pk_test_..."
```

> `NEXT_PUBLIC_*` se inyectan en **build time**, no en runtime. Recompilar si cambian.

---

## 2. Base de datos

1. Crear base PostgreSQL en tu proveedor (Railway, Supabase, AWS RDS, etc.).
2. Ejecutar migraciones:
   ```bash
   cd apps/api
   npx prisma migrate deploy
   ```
3. (Opcional) Seed inicial:
   ```bash
   npx prisma db seed
   ```

---

## 3. API — Express

### Build
```bash
cd apps/api
npm install
npx prisma generate
npm run build
```

### Start
```bash
npm run start
```
Escucha en `0.0.0.0:PORT` (compatible con contenedores).

### Archivos estáticos (uploads)
- Las imágenes subidas se guardan en `apps/api/uploads/`.
- En producción con contenedores, usa un **volumen persistente** o **S3**; de lo contrario se perderán en cada deploy.

---

## 4. Web — Next.js

### Build
```bash
cd apps/web
npm install
npm run build
```

### Start
```bash
npm run start
```

### Notas
- `next.config.js` tiene `images.unoptimized: true` para compatibilidad con cualquier host (incluido Vercel).
- El middleware de auth redirige rutas protegidas si no hay cookie de token.

---

## 5. Opciones de hosting rápido

| Servicio | API | Web | DB |
|---|---|---|---|
| **Railway** | Node | Node | PostgreSQL addon |
| **Render** | Web Service | Static Site / Web Service | PostgreSQL |
| **Vercel** | — | Next.js (serverless) | — |
| **Fly.io** | Dockerfile | Dockerfile | Fly Postgres |

---

## 6. Checklist pre-despliegue

- [ ] `DATABASE_URL` apunta a PostgreSQL productivo
- [ ] `JWT_SECRET` es fuerte y único
- [ ] `CORS_ORIGIN` coincide con el dominio de la web
- [ ] `NEXT_PUBLIC_API_BASE_URL` apunta a la API productiva
- [ ] Migraciones aplicadas (`prisma migrate deploy`)
- [ ] Archivos de uploads persistentes o migrados a S3
- [ ] Variables de Culqi configuradas (test o live según ambiente)

---

## 7. Docker (opcional)

Si prefieres contenedores, crea un `Dockerfile` en cada app:

### API
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Web
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

*Última actualización: 2026-06-22*
