# MORA Peluqueria & Spa

Monorepo with an ExpressJS API, Prisma/PostgreSQL, and a Next.js application for public booking and admin operations.

## What is included
- Client registration and login
- Online booking flow backed by real availability
- Admin dashboard, agenda, reservations, clients, staff, services, promotions, products, albums, and reviews pages
- Prisma seed with starter roles, admin user, service catalog, staff, schedules, and an active web promotion

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
5. Seed initial operational data:
   npm --workspace apps/api run seed
6. Run dev servers:
   npm run dev

API will run at http://localhost:4000/api
Next.js app will run at http://localhost:3000

## Seed defaults
- Admin username: value from ADMIN_USERNAME or admin
- Admin password: value from ADMIN_PASSWORD or admin123
- Starter catalog: 6 services, 3 staff members, weekly salon schedule, 1 active promotion
