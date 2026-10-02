const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'civicfix.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('citizen','officer','admin')),
    department_id TEXT REFERENCES departments(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    citizen_id TEXT REFERENCES users(id),
    category TEXT NOT NULL,
    category_label TEXT NOT NULL,
    description TEXT,
    photo_path TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    department_id TEXT NOT NULL REFERENCES departments(id),
    status TEXT NOT NULL DEFAULT 'Reported',
    severity TEXT NOT NULL DEFAULT 'Medium',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id TEXT NOT NULL REFERENCES issues(id),
    status TEXT NOT NULL,
    remarks TEXT,
    updated_by TEXT,
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
  CREATE INDEX IF NOT EXISTS idx_issues_dept ON issues(department_id);
  CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
  CREATE INDEX IF NOT EXISTS idx_logs_issue ON status_logs(issue_id);
`);

// ---- Seed departments (idempotent) ----
const DEPARTMENTS = [
  { id: 'dept-roads', name: 'Roads & Public Works' },
  { id: 'dept-sanitation', name: 'Sanitation Dept.' },
  { id: 'dept-electrical', name: 'Electrical Dept.' },
  { id: 'dept-water', name: 'Water Works Dept.' },
  { id: 'dept-general', name: 'General Administration' }
];
const insertDept = db.prepare('INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)');
DEPARTMENTS.forEach(d => insertDept.run(d.id, d.name));

// ---- Seed demo accounts (idempotent) ----
// Demo password for ALL seeded accounts: "password123"
// Change these before any real deployment — this is a student-project seed, not production auth.
const DEMO_PASSWORD_HASH = bcrypt.hashSync('password123', 10);
const seedUsers = [
  { id: 'user-admin', name: 'Admin (all departments)', email: 'admin@civicfix.dev', role: 'admin', dept: null },
  { id: 'user-off-roads', name: 'Officer R. Verma', email: 'roads@civicfix.dev', role: 'officer', dept: 'dept-roads' },
  { id: 'user-off-sanitation', name: 'Officer S. Nair', email: 'sanitation@civicfix.dev', role: 'officer', dept: 'dept-sanitation' },
  { id: 'user-off-electrical', name: 'Officer A. Khan', email: 'electrical@civicfix.dev', role: 'officer', dept: 'dept-electrical' },
  { id: 'user-off-water', name: 'Officer M. Joshi', email: 'water@civicfix.dev', role: 'officer', dept: 'dept-water' },
  { id: 'user-citizen-demo', name: 'Demo Citizen', email: 'citizen@civicfix.dev', role: 'citizen', dept: null }
];
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, name, email, password_hash, role, department_id)
  VALUES (@id, @name, @email, @password_hash, @role, @dept)
`);
seedUsers.forEach(u => insertUser.run({ ...u, password_hash: DEMO_PASSWORD_HASH }));

module.exports = db;
