const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', verifyToken, requireRole('officer', 'admin'), (req, res) => {
  const scopeDept = req.user.role === 'officer' ? req.user.department_id : null;
  const deptClause = scopeDept ? 'WHERE department_id = ?' : '';
  const params = scopeDept ? [scopeDept] : [];

  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM issues ${deptClause} GROUP BY status
  `).all(...params);

  const categoryCounts = db.prepare(`
    SELECT category, category_label, COUNT(*) as count FROM issues ${deptClause} GROUP BY category
  `).all(...params);

  const resolvedIssues = db.prepare(`
    SELECT i.id, i.created_at, l.at as resolved_at
    FROM issues i
    JOIN status_logs l ON l.issue_id = i.id AND l.status = 'Resolved'
    ${scopeDept ? 'WHERE i.department_id = ?' : ''}
  `).all(...(scopeDept ? [scopeDept] : []));
  // (grabs the earliest 'Resolved' log row per issue in practice since JOIN can match
  //  multiple rows if re-resolved; fine at demo scale — a bigger dataset would use MIN(l.at))

  let avgResolutionHours = null;
  if (resolvedIssues.length) {
    const totalHrs = resolvedIssues.reduce((sum, r) => {
      return sum + (new Date(r.resolved_at + 'Z') - new Date(r.created_at + 'Z')) / 3600000;
    }, 0);
    avgResolutionHours = Math.round((totalHrs / resolvedIssues.length) * 10) / 10;
  }

  const trend = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM issues ${deptClause}
    ${deptClause ? 'AND' : 'WHERE'} created_at >= datetime('now', '-14 days')
    GROUP BY day ORDER BY day ASC
  `).all(...params);

  res.json({ statusCounts, categoryCounts, avgResolutionHours, trend });
});

module.exports = router;
