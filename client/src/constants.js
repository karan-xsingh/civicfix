export const CATEGORIES = [
  { id: 'pothole', label: 'Pothole / Road Damage', dept: 'Roads & Public Works' },
  { id: 'garbage', label: 'Garbage / Sanitation', dept: 'Sanitation Dept.' },
  { id: 'streetlight', label: 'Streetlight Outage', dept: 'Electrical Dept.' },
  { id: 'water', label: 'Water Leakage', dept: 'Water Works Dept.' },
  { id: 'other', label: 'Other Civic Issue', dept: 'General Administration' }
];

export const SEVERITIES = ['Low', 'Medium', 'High'];
export const STATUSES = ['Reported', 'Acknowledged', 'In Progress', 'Resolved'];
export const DEFAULT_CENTER = [28.6139, 77.209]; // New Delhi, generic default

export function statusColor(status) {
  if (status === 'Reported') return '#D8571F';
  if (status === 'Resolved') return '#3A7D5D';
  return '#3E6680';
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
