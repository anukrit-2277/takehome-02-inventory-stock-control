import { api } from './client.js';

/** Turns { search: 'bolt', page: 2 } into "?search=bolt&page=2", dropping blanks. */
export function toQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  }
  const string = query.toString();
  return string ? `?${string}` : '';
}

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const items = {
  list: (params) => api.get(`/items${toQuery(params)}`),
  get: (id) => api.get(`/items/${id}`),
  stock: (id) => api.get(`/items/${id}/stock`),
  timeline: (id, params) => api.get(`/items/${id}/timeline${toQuery(params)}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.patch(`/items/${id}`, data),
  archive: (id) => api.post(`/items/${id}/archive`),
  restore: (id) => api.post(`/items/${id}/restore`),
  addNote: (id, note) => api.post(`/items/${id}/notes`, { note }),
};

export const movements = {
  list: (params) => api.get(`/movements${toQuery(params)}`),
  create: (data) => api.post('/movements', data),
};

export const categories = {
  list: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.patch(`/categories/${id}`, data),
  remove: (id) => api.delete(`/categories/${id}`),
};

export const locations = {
  list: () => api.get('/locations'),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.patch(`/locations/${id}`, data),
};

export const users = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  setLocations: (id, locationIds) => api.put(`/users/${id}/locations`, { locationIds }),
};

export const alerts = {
  lowStock: (params) => api.get(`/alerts/low-stock${toQuery(params)}`),
  dismiss: (itemId) => api.post(`/alerts/low-stock/${itemId}/dismiss`),
  restore: (itemId) => api.delete(`/alerts/low-stock/${itemId}/dismiss`),
};

export const dashboard = {
  get: () => api.get('/dashboard'),
};

export const imports = {
  items: (file) => api.upload('/imports/items', file),
  receipts: (file) => api.upload('/imports/receipts', file),
};

export const exports = {
  stockPosition: (params) =>
    api.download(`/exports/stock-position${toQuery(params)}`, 'stock-position.csv'),
};
