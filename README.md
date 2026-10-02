# CivicFix — Smart Civic Issue Reporting & Resolution System

A full-stack platform where citizens report civic issues (potholes, garbage, broken streetlights,
water leakage) with a photo and location, the system auto-routes each report to the correct
municipal department, and both citizens and officers track it through to resolution.

Built as a civil engineering internship major project — this repo is a real, runnable full-stack
application: a Node/Express + SQLite REST API with JWT auth and role-based access control, and a
React + Tailwind frontend. Every endpoint below has been tested end-to-end, not just written.

---

## 1. Feature list

**Citizen-facing**
- Report an issue: category picker, severity picker, map-based location pinning (Leaflet), photo upload
- **AI Assist**: client-side computer-vision heuristic (pixel darkness ratio + luminance variance)
  that analyzes the uploaded photo and suggests a severity level with a confidence score
- Voice-to-text description input (Web Speech API)
- Duplicate-report warning — checks for open reports of the same category within 60m before you submit
- Public map of all reports, color-coded by status, with a custom canvas-rendered **hotspot heatmap**
  (built from scratch with radial-gradient alpha compositing + a gradient LUT — no external heatmap library)
- Track a Report: look up any ticket by ID, see full status history, get a live toast notification
  the moment an officer updates it (15s polling)

**Officer/admin-facing**
- JWT-authenticated login, role-scoped to a department (or `admin` for all departments)
- Officer Desk: ticket list with filters (status, sort by newest/oldest/severity), status + remarks updates
- Role-based access control enforced server-side: officers can only update tickets in their own department;
  citizens cannot update ticket status at all (both are verified with real 403 responses, not just hidden UI)
- Analytics: status counts, 14-day report trend chart (Recharts), category breakdown, average resolution time
- SLA / overdue flagging — tickets that sit too long in a status get flagged automatically
- CSV export of the current ticket list

**Platform**
- Dark mode
- Toast notification system throughout

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | SQLite via `better-sqlite3` (file-based, zero setup — swappable for PostgreSQL, see §6) |
| Auth | JWT (`jsonwebtoken`) + bcrypt password hashing (`bcryptjs`) |
| File uploads | `multer` (photos stored on disk, served statically) |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS (custom "municipal infrastructure" design tokens) |
| Maps | Leaflet + OpenStreetMap tiles |
| Charts | Recharts |
| Routing | React Router v6 |

---

## 3. Architecture

```
┌──────────────────┐        JWT-authenticated REST API        ┌───────────────────────┐
│   React Frontend  │ ─────────────────────────────────────▶ │   Express API Server   │
│  (Vite + Tailwind)│ ◀───────────────────────────────────── │   (role-based routes)  │
└──────────────────┘                                          └───────────┬───────────┘
                                                                            │
                                                          ┌─────────────────┼─────────────────┐
                                                          ▼                 ▼                 ▼
                                                  ┌───────────────┐ ┌─────────────┐  ┌──────────────┐
                                                  │  SQLite DB     │ │  /uploads    │  │  bcrypt/JWT   │
                                                  │  users         │ │  photo files │  │  auth layer   │
                                                  │  departments   │ └─────────────┘  └──────────────┘
                                                  │  issues        │
                                                  │  status_logs   │
                                                  └───────────────┘
```

**Request flow for a new report:**
1. Citizen submits category + location + optional photo (frontend runs the AI Assist heuristic locally first).
2. `POST /api/issues` looks up the category → department mapping and inserts the issue + first status log.
3. Officer of that department logs in, sees the ticket on their scoped Officer Desk, updates status.
4. `PATCH /api/issues/:id/status` checks the officer's `department_id` matches the ticket's before allowing the update.
5. Citizen on the Track a Report page is polling that ticket; the moment the status changes, a toast fires.

---

## 4. Database schema

```
departments      users                    issues                      status_logs
─────────────    ─────────────────────    ────────────────────────    ─────────────────
id (PK)          id (PK)                  id (PK)                     id (PK, autoinc)
name             name                     citizen_id → users.id       issue_id → issues.id
                 email (unique)           category                    status
                 password_hash            category_label              remarks
                 role                     description                 updated_by
                 department_id → depts    photo_path                  at
                 created_at               lat, lng
                                          department_id → depts
                                          status
                                          severity
                                          created_at, updated_at
```

---

## 5. Running it locally

### Backend
```bash
cd server
cp .env.example .env      # edit JWT_SECRET before any real deployment
npm install
npm run start              # or: npm run dev  (nodemon, auto-restart)
```
The API boots on `http://localhost:4000` and creates `civicfix.db` automatically on first run,
seeded with 5 departments and demo accounts (see below).

### Frontend
```bash
cd client
npm install
npm run dev
```
Opens on `http://localhost:5173`. It talks to the backend at `http://localhost:4000` by default —
override with a `VITE_API_BASE` env var if you deploy the backend elsewhere.

### Demo accounts (seeded automatically, password for all: `password123`)
| Role | Email |
|---|---|
| Admin (all departments) | `admin@civicfix.dev` |
| Officer — Roads & Public Works | `roads@civicfix.dev` |
| Officer — Sanitation | `sanitation@civicfix.dev` |
| Officer — Electrical | `electrical@civicfix.dev` |
| Officer — Water Works | `water@civicfix.dev` |

Citizens don't need an account to submit a report — you can also register one from the app.

---

## 6. API reference (summary)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create a citizen account |
| POST | `/api/auth/login` | — | Log in, returns JWT |
| GET | `/api/auth/me` | JWT | Current user info |
| GET | `/api/departments` | — | List departments |
| POST | `/api/issues` | optional | Create a report (multipart form: category, description, lat, lng, severity, photo) |
| GET | `/api/issues` | — | List/filter reports (`status`, `department_id`, `category` query params) |
| GET | `/api/issues/:id` | — | Get one ticket with full status history |
| GET | `/api/issues/duplicates` | — | Nearby open reports of the same category (`lat`, `lng`, `category`) |
| PATCH | `/api/issues/:id/status` | JWT, officer/admin | Update status + remarks (department-scoped) |
| GET | `/api/analytics/summary` | JWT, officer/admin | Status counts, category breakdown, 14-day trend, avg. resolution time |

---

## 7. Known limitations / honest scope notes

Being upfront about these is what makes the project credible in an interview or viva:

- **AI Assist is a pixel-analysis heuristic, not a trained model.** It's a legitimate, working
  computer-vision technique (luminance variance + darkness ratio as a proxy for shadow depth/texture),
  but it is not a CNN. The natural next step — and a good thing to say out loud if asked — is
  swapping it for a model fine-tuned on a labeled pothole/garbage dataset (e.g. a MobileNet or YOLO
  backbone), served from a `/api/classify` endpoint instead of running client-side.
- **SQLite, not PostgreSQL/PostGIS.** This was a deliberate choice for zero-setup local running.
  Migrating to PostgreSQL means swapping `better-sqlite3` for `pg`, and the ward/department routing
  table in `server/src/utils/geo.js` would become a `ST_Contains` geo-query against real ward boundaries
  instead of a flat category→department lookup.
- **Photo storage is local disk**, served statically. A production deployment would use S3 or
  equivalent object storage instead.
- **Seeded officer accounts**, not an admin-provisioning flow. Realistic municipal staff accounts
  would be created by an admin panel, not self-registration — this is noted directly in the code.

---

## 8. Suggested resume bullet points

> Built CivicFix, a full-stack civic issue reporting platform (React, Node/Express, SQLite) with
> JWT authentication, role-based access control, and geolocation-based department auto-routing.

> Implemented a client-side computer-vision severity estimator using canvas pixel analysis, and a
> custom heatmap rendering engine built from scratch with radial-gradient alpha compositing.

> Designed and built a relational schema (departments, users, issues, status logs) with a REST API
> covering auth, CRUD, file uploads, analytics aggregation, and department-scoped authorization —
> verified end-to-end with live API testing.

---

## 9. Deploying it for a live demo

- **Backend**: Render or Railway (free tier) — set `JWT_SECRET` and `CLIENT_ORIGIN` env vars.
- **Frontend**: Vercel or Netlify — set `VITE_API_BASE` to your deployed backend URL.
- SQLite's file-based storage works fine on Render's persistent disk; if you outgrow it, migrating
  to a managed Postgres instance (Render/Railway both offer one) is the natural next step (see §7).
