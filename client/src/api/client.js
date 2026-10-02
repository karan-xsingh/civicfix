import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const api = axios.create({ baseURL: API_BASE + '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('civicfix_token');
  // Note: this is a plain Vite/React app running in the user's own browser (not a
  // claude.ai artifact), so localStorage is the normal, correct choice here.
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
