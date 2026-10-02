const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const depts = db.prepare('SELECT * FROM departments ORDER BY name').all();
  res.json({ departments: depts });
});

module.exports = router;
