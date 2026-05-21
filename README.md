# MORA Peluqueria & Spa

Monorepo with ExpressJS API and a minimal Next.js app.

## Requirements
- Node.js 18+
- PostgreSQL

## Setup
1. Install dependencies:
   npm install
2. Copy environment template:
   copy apps\api\.env.example apps\api\.env
3. Update DATABASE_URL and JWT values in apps\api\.env
4. Generate Prisma client and run migrations:
   npm --workspace apps/api run prisma:generate
   npm --workspace apps/api run prisma:migrate
5. Seed initial roles/admin:
   npm --workspace apps/api run seed
6. Run dev servers:
   npm run dev

API will run at http://localhost:4000/api
Next.js placeholder will run at http://localhost:3000
