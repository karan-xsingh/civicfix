const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { verifyToken, optionalAuth, requireRole } = require('../middleware/auth');
const { haversineMeters, CATEGORY_MAP, isOverdue } = require('../utils/geo');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, uuid() + path.extname(file.originalname || '.jpg'))
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  }
});

function decorate(issue) {
  const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(issue.department_id);
  return {
    ...issue,
    department_name: dept ? dept.name : issue.department_id,
    overdue: isOverdue(issue),
    photo_url: issue.photo_path ? `/uploads/${issue.photo_path}` : null
  };
}

function withLogs(issue) {
  const logs = db.prepare('SELECT * FROM status_logs WHERE issue_id = ? ORDER BY at ASC').all(issue.id);
  return { ...decorate(issue), logs };
}

// ---- Create a report ----
router.post('/', optionalAuth, upload.single('photo'), (req, res) => {
  const { category, description, lat, lng, severity } = req.body;
  if (!category || !CATEGORY_MAP[category]) return res.status(400).json({ error: 'Valid category is required.' });
  if (lat == null || lng == null) return res.status(400).json({ error: 'Location (lat/lng) is required.' });

  const { label, dept } = CATEGORY_MAP[category];
  const id = 'issue-' + uuid();
  const photoPath = req.file ? req.file.filename : null;

  db.prepare(`
    INSERT INTO issues (id, citizen_id, category, category_label, description, photo_path, lat, lng, department_id, status, severity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Reported', ?)
  `).run(
    id, req.user ? req.user.id : null, category, label, description || '', photoPath,
    parseFloat(lat), parseFloat(lng), dept, severity && ['Low','Medium','High'].includes(severity) ? severity : 'Medium'
  );
  db.prepare(`INSERT INTO status_logs (issue_id, status, remarks, updated_by) VALUES (?, 'Reported', 'Citizen report submitted.', ?)`)
    .run(id, req.user ? req.user.id : 'anonymous');

  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(id);
  res.status(201).json({ issue: withLogs(issue) });
});

// ---- List / filter issues (public — powers the transparency map) ----
router.get('/', (req, res) => {
  const { status, department_id, category } = req.query;
  let sql = 'SELECT * FROM issues WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (department_id) { sql += ' AND department_id = ?'; params.push(department_id); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY created_at DESC';
  const issues = db.prepare(sql).all(...params).map(decorate);
  res.json({ issues });
});

// ---- Nearby duplicate check (public) ----
router.get('/duplicates', (req, res) => {
  const { lat, lng, category, radius } = req.query;
  if (lat == null || lng == null || !category) return res.status(400).json({ error: 'lat, lng and category are required.' });
  const r = radius ? parseFloat(radius) : 60;
  const candidates = db.prepare(`SELECT * FROM issues WHERE category = ? AND status != 'Resolved'`).all(category);
  const nearby = candidates
    .filter(i => haversineMeters(parseFloat(lat), parseFloat(lng), i.lat, i.lng) < r)
    .map(decorate);
  res.json({ nearby });
});

// ---- Get single issue with full history (public — powers "Track a Report") ----
router.get('/:id', (req, res) => {
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'No ticket found with that ID.' });
  res.json({ issue: withLogs(issue) });
});

// ---- Update status (officer/admin only, scoped to own department unless admin) ----
router.patch('/:id/status', verifyToken, requireRole('officer', 'admin'), (req, res) => {
  const { status, remarks } = req.body;
  const VALID = ['Reported', 'Acknowledged', 'In Progress', 'Resolved'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid status value.' });

  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'No ticket found with that ID.' });
  if (req.user.role === 'officer' && req.user.department_id !== issue.department_id) {
    return res.status(403).json({ error: 'This ticket belongs to a different department.' });
  }

  db.prepare(`UPDATE issues SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, issue.id);
  db.prepare(`INSERT INTO status_logs (issue_id, status, remarks, updated_by) VALUES (?, ?, ?, ?)`)
    .run(issue.id, status, remarks || '(no remarks)', req.user.name);

  const updated = db.prepare('SELECT * FROM issues WHERE id = ?').get(issue.id);
  res.json({ issue: withLogs(updated) });
});

module.exports = router;
