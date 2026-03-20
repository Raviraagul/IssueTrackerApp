# Issue Tracker App

A full-stack issue tracking web application built for RR Solutions to manage and track software bugs and tickets across teams and products.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TailwindCSS |
| Backend | Node.js + Express 4.18.2 |
| Database | PostgreSQL 17 |
| Excel Parsing | Python 3 + Pandas + OpenPyXL |

---

## Project Structure

```
IssueTrackerApp/
├── client/          # React frontend (Vite)
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # AuthContext (JWT session)
│   │   ├── pages/        # Page components
│   │   └── api.js        # Axios API client
├── server/          # Node.js backend
│   ├── routes/
│   │   ├── auth.js       # Login, users, JWT
│   │   ├── tickets.js    # Ticket CRUD + history
│   │   ├── import.js     # Excel import + snapshots
│   │   └── reports.js    # Daily movement + standard reports
│   └── db.js             # PostgreSQL pool
└── python/          # Excel import scripts
    ├── import_excel.py   # Main import logic
    └── config.py         # Status mappings (single source of truth)
```

---

## Features

### Authentication
- JWT-based login with 8-hour token expiry
- Role-based access control (Admin / Editor / Viewer)
- Team-based access (API / Web / App / Support)
- Change name and password from user dropdown

### Tickets
- Full ticket list with filters: Search, Team, Product, Status, Priority, Date range
- Collapsible date filter with active filter indicator
- Missing ticket detection (tickets absent from latest import)
- Ticket detail page with:
  - Status pipeline visualization
  - Inline field editing (Status, Priority, Assigned To, Team, Fixed Date, Comments)
  - Root Cause Analysis section (Category, Description, Fix Description)
  - Full status history timeline (import vs manual changes)

### Import
- Excel upload with snapshot date selection
- Supports 3 team sheets: API, Web, App
- Detects new tickets, status changes, and field updates
- Auto-sets fixed date when status changes to Fixed
- Builds `report_snapshots` after every import
- Import restricted to Admin only

### Reports
- **Standard Reports** — Team Wise, Overall, Summary tabs
- **Daily Movement Report** — Live Move, Closed, Pre Prod, New Issues, Dev totals per date with forward-fill for dates with no import
- Export to CSV

### Users (Admin only)
- Create, edit, deactivate users
- Assign roles and teams
- Reset passwords
- Access hint shows exactly what each role+team combination can do

---

## Database Tables

| Table | Description |
|---|---|
| `tickets` | Current state of all tickets |
| `ticket_status_history` | Every status change (import + manual) |
| `report_snapshots` | Pre-computed daily summary per product/team |
| `change_history` | Field-level audit log |
| `import_log` | Import history |
| `users` | User accounts with roles and teams |
| `archive` | Archived tickets |

---

## Role & Access Matrix

| Team | Role | Tickets Visible | Can Edit | Import | Reports |
|---|---|---|---|---|---|
| — | Admin | All | All | ✅ | ✅ |
| — | Editor | All | All | ❌ | ✅ |
| — | Viewer | All | ❌ | ❌ | ✅ |
| Support | Editor | All | All | ❌ | ✅ |
| Support | Viewer | All | ❌ | ❌ | ✅ |
| API/Web/App | Editor | Own team | Own team | ❌ | ✅ |
| API/Web/App | Viewer | Own team | ❌ | ❌ | ✅ |

---

## Status Categories

Defined in `python/config.py` — single source of truth.

| Display Name | Category Key | Active? |
|---|---|---|
| Yet to Start (Dev) | yet_to_start | ✅ |
| In-Progress (Dev) | in_progress | ✅ |
| Completed (Dev) | completed_dev | ✅ |
| Pre Production | pre_prod | ✅ |
| Fixed | fixed | ❌ |
| Closed | closed | ❌ |

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 17
- Python 3.10+

### Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd client
npm install

# Python
pip install pandas openpyxl numpy
```

### Environment variables

Create `server/.env` — see `.env.example` for required variables.
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your_jwt_secret_here
PORT=5000
```

### Run locally

```bash
# Backend (port 5000)
cd server
node server.js

# Frontend (port 5173)
cd client
npm run dev
```

---

## Excel Import Format

The Excel file must have 3 sheets:
- `Module Wise Issue - API`
- `Module Wise Issue - Web`
- `Module Wise Issue - App`

Each sheet must have a header row containing `Ticket No` with columns:
`Ticket No`, `Date`, `Company`, `Product Name`, `Web/App`, `Module`, `Sub Module`, `Issue Description`, `Priority`, `Status`, `Assigned to`, `Comments`, `Fixed status`, `Fixed Date`

---

## Key Design Decisions

- **Excel is source of truth** for ticket data — imports overwrite most fields
- **Fixed date** is set once (on first Fixed status) and never overwritten by import
- **computeSnapshot** rebuilds `report_snapshots` after every import and manual status change
- **ticket_status_history** tracks every status change for timeline and trend reports
- **Forward-fill** in daily movement report fills dates with no import using last known snapshot
