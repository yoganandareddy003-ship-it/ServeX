# SERVEX Bike Service & Ownership History

Full-stack BCA project using:
- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js, Express.js
- Database: MySQL
- Authentication: JWT + bcryptjs

## Project structure

serveX-bike-service/
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── booking.js
│   │   ├── dashboard.js
│   │   ├── history.js
│   │   └── vehicles.js
│   ├── .env.example
│   ├── db.js
│   ├── package.json
│   └── server.js
├── database/
│   └── servex.sql
└── frontend/
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── api.js
    │   ├── auth.js
    │   ├── dashboard.js
    │   ├── vehicles.js
    │   ├── booking.js
    │   └── history.js
    ├── index.html
    ├── login.html
    ├── register.html
    ├── dashboard.html
    ├── my-vehicles.html
    ├── book-service.html
    └── service-history.html

## 1. Create the MySQL database

Open MySQL Workbench and run:

database/servex.sql

It creates the `servex` database and all tables.

## 2. Configure backend

Open:

backend/.env

Use:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=servex
DB_PORT=3306
JWT_SECRET=replace_with_at_least_32_random_characters
PORT=5000
NODE_ENV=development
CORS_ORIGINS=

Password recovery sends a single-use reset link by email. Configure
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and
`SMTP_FROM` in `backend/.env`; for Gmail, use a Google App Password. Set
`APP_BASE_URL` to the public application URL in deployed environments. Reset
links expire after 30 minutes, and reset tokens are stored only as SHA-256
hashes. The API never returns reset tokens. See `backend/.env.example` for the
complete template.

You can create it by copying `.env.example` to `.env`.

## 3. Install backend packages

Open terminal in the backend folder:

cd backend
npm install

## 4. Start backend

npm run dev

Expected:

ServeX running at http://localhost:5000

## 5. Open the application

Go to:

http://localhost:5000

The login page opens first.

Register a user, log in, add a bike, and book a service.

## API endpoints

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me

GET    /api/vehicles
POST   /api/vehicles
PUT    /api/vehicles/:id
DELETE /api/vehicles/:id

GET  /api/bookings
POST /api/bookings
PUT  /api/bookings/:id/cancel

GET /api/history

GET /api/dashboard/stats


# ADMIN PANEL

The admin side is included.

## Apply the admin database patch

Run this file in MySQL Workbench:

database/admin_patch.sql

This patch is required for existing databases before marking bookings as completed. New databases created from `database/servex.sql` already include the booking link.

It adds:
- `users.role`
- `service_history.booking_id`

## Create the first admin account

From the backend folder:

```powershell
node create-admin.js
```

Set these values in `backend/.env` before running the script:

```text
ADMIN_NAME=SERVEX Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-unique-password-at-least-12-characters
```

The admin password must be at least 12 characters. The script no longer ships or prints a default password.

## Admin login

Open:

http://localhost:5000/admin-login.html

## Password recovery

Run `database/password_reset.sql` after creating the database. Forgot password
works locally without email by displaying a reset link. Production requires
SMTP. Reset links expire after 15 minutes and can only be used once.

## Admin modules

- Admin Dashboard
- Manage Users
- Manage Vehicles
- Manage Bookings
- Manage Services
- Change booking status
- Automatically create service-history records when a booking is completed
- Change user roles
- Add/edit/delete services
- View revenue and platform statistics

Normal registration always creates a normal `user` account.
Only users with `role='admin'` can access `/api/admin/*`.

## Project comparison

Reviewed ten public repositories on 2026-09-29. These are feature comparisons based on their public repository descriptions and READMEs; they are not independent security or quality audits.

| Project | Publicly described focus |
|---|---|
| [Bike Service Management Platform](https://github.com/srishti0503/bike-service-management-platform) | Online booking, admin booking search/filter, status management |
| [Bike Service Management System](https://github.com/mandy-s-27/Bike-Service-Management-System) | Customer bookings plus mechanic assignment and repair notes |
| [Nish Bike Service](https://github.com/MdThanish/Mern-realtime-bikeService-app) | Booking/history, admin service management, status and email notifications |
| [Bike Servicing Management](https://github.com/mdyeasinhn/Bike-serviceing-management) | Booking/status API, PostgreSQL/Prisma, deployment guide |
| [Garage Management System](https://github.com/uttamjagani/Garage_Management_system) | Flutter garage/service booking starter |
| [NEKA Service Booking Desk](https://github.com/mahilnila2007-hue/Bike-Car-Service-Booking-Desk) | Service jobs, live progress, bays, mechanics, bills and parts |
| [BIKEBUDDY](https://github.com/vijeshkr/BikeBuddy-frontend) | Customer/mechanic/admin roles, real-time updates, payments and inventory |
| [Bike Care App](https://github.com/dev0513-cyber/bike-care-app) | Booking, doorstep scheduling, service estimates and deployment setup |
| [GLIMO](https://github.com/GLEMATES/GLIMO) | Motorcycle tracking, maintenance reminders, trip history and tests |
| [Moto Service Management](https://github.com/hmian1998/moto-service-management) | Motorcycle service POS concept |

SERVEX already covers the common customer booking, vehicle, history, and admin workflows, and adds password recovery. This improvement pass focuses on operational security: explicit JWT configuration, restricted CORS, request limits, security headers, auth rate limits, and non-default admin credentials. Mechanic assignment, live job tracking, inventory, and billing remain sensible next product features rather than being added without their supporting data model and workflows.

## Security configuration

- `JWT_SECRET` must be at least 32 characters. Generate a unique value and keep it out of source control.
- `CORS_ORIGINS` is an optional comma-separated allow-list for separate frontend origins. Leave it empty when the frontend is served by this Express app.
- Configure admin credentials with `ADMIN_NAME`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 12 characters before running `node create-admin.js`.
- Login and registration endpoints have IP-based rate limits. Production deployments behind a reverse proxy should configure Express `trust proxy` to match their proxy topology before relying on IP-based limits.
- Helmet applies standard HTTP security headers. Content Security Policy remains disabled while the current pages use inline event handlers and external image/font assets; migrate those before enforcing a strict CSP.

## Checks

Run the backend checks from the `backend` directory:

```bash
npm test
npm run check
```
