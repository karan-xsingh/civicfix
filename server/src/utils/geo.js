// Distance + routing helpers shared by the API

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Category -> (label, department) routing table.
// This is the auto-assignment logic: in a real municipal deployment this table
// would instead be looked up per-ward from a GIS boundary table (PostGIS ST_Contains),
// since different wards can route the same category to different local offices.
const CATEGORY_MAP = {
  pothole: { label: 'Pothole / Road Damage', dept: 'dept-roads' },
  garbage: { label: 'Garbage / Sanitation', dept: 'dept-sanitation' },
  streetlight: { label: 'Streetlight Outage', dept: 'dept-electrical' },
  water: { label: 'Water Leakage', dept: 'dept-water' },
  other: { label: 'Other Civic Issue', dept: 'dept-general' }
};

const SLA_DAYS = { Reported: 2, Acknowledged: 5, 'In Progress': 10 };

function isOverdue(issue) {
  if (issue.status === 'Resolved') return false;
  const days = SLA_DAYS[issue.status];
  if (days == null) return false;
  const ageDays = (Date.now() - new Date(issue.created_at + 'Z').getTime()) / 86400000;
  return ageDays > days;
}

module.exports = { haversineMeters, CATEGORY_MAP, SLA_DAYS, isOverdue };
