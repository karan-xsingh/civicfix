require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const issuesRoutes = require('./routes/issues.routes');
const departmentsRoutes = require('./routes/departments.routes');
const analyticsRoutes = require('./routes/analytics.routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'civicfix-server', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`CivicFix API listening on http://localhost:${PORT}`);
});
