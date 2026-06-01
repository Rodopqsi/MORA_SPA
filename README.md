# MORA Peluqueria & Spa

Monorepo with an ExpressJS API, Prisma/PostgreSQL, a Next.js web app, and a Flutter mobile app for the same operational platform.

## What is included
- Client registration and login
- Online booking flow backed by real availability
- Public mini-ecommerce for products with catalog, cart, checkout, and real order registration
- Web admin dashboard with agenda, reservations, clients, staff, services, promotions, products, albums, and reviews
- Flutter mobile app with public home, booking flow, account area, persistent cart, checkout, and a mobile admin console
- Prisma seed with starter roles, admin user, service catalog, staff, schedules, an active promotion, and ecommerce products

## Requirements
- Node.js 18+
- PostgreSQL
- Flutter 3.41+ if you want to run the mobile app

## Setup
1. Install root dependencies:
   npm install
2. Copy environment template:
   copy apps\api\.env.example apps\api\.env
3. Update DATABASE_URL and JWT values in apps\api\.env
4. Generate Prisma client and run migrations:
   npm --workspace apps/api run prisma:generate
   npm --workspace apps/api run prisma:migrate
5. Seed initial operational data:
   npm --workspace apps/api run seed
6. Install Flutter dependencies:
   npm run mobile:get
7. Run the API and web app:
   npm run dev

API will run at http://localhost:4000/api
Next.js app will run at http://localhost:3000

## Flutter app
The mobile app lives in apps/mobile and connects directly to the same API.

### Main mobile features
- Public landing experience with live services, promotions, team, and products
- Client login and registration with persistent session
- Booking flow using live availability from /client-availability
- Account area with profile sync, reservations, albums, and reviews
- Product cart and checkout creating real sales through /public/orders
- Staff login plus mobile admin console for metrics, reservations, services, staff, promotions, products, sales, and clients

### Mobile commands
- Install Flutter packages:
  npm run mobile:get
- Run Flutter analysis:
  npm run mobile:analyze
- Run Flutter tests:
  npm run mobile:test
- Launch the Flutter app:
  npm run mobile:run

### API URL configuration for Flutter
By default the mobile app resolves the backend like this:
- Android emulator: http://10.0.2.2:4000/api
- Desktop or iOS simulator: http://localhost:4000/api

If you need a different host, launch Flutter with a custom API URL:

```bash
flutter run --dart-define=API_URL=http://192.168.1.50:4000/api
```

Use that pattern for physical devices or remote testing.

## Seed defaults
- Admin username: value from ADMIN_USERNAME or admin
- Admin password: value from ADMIN_PASSWORD or admin123
- Starter catalog: 6 services, 3 staff members, weekly salon schedule, 1 active promotion, and 4 ecommerce products with images
