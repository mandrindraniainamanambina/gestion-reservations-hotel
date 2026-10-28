// Toutes les routes de l'API Django, regroupées par module.
import { api } from "./api.js";

export const authApi = {
  login: (username, password) => api.post("/auth/login/", { username, password }),
  logout: () => api.post("/auth/logout/"),
  me: () => api.get("/auth/me/"),
};

export const utilisateursApi = {
  list: (params) => api.get("/utilisateurs/", params),
  create: (data) => api.post("/utilisateurs/", data),
  update: (id, data) => api.patch(`/utilisateurs/${id}/`, data),
  desactiver: (id) => api.post(`/utilisateurs/${id}/desactiver/`),
  activer: (id) => api.post(`/utilisateurs/${id}/activer/`),
};

export const categoriesApi = {
  list: () => api.get("/categories/"),
  create: (data) => api.post("/categories/", data),
  remove: (id) => api.delete(`/categories/${id}/`),
};

export const chambresApi = {
  list: (params) => api.get("/chambres/", params),
  disponibles: (params) => api.get("/chambres/disponibles/", params),
  create: (data) => api.post("/chambres/", data),
  update: (id, data) => api.patch(`/chambres/${id}/`, data),
  desactiver: (id) => api.post(`/chambres/${id}/desactiver/`),
  activer: (id) => api.post(`/chambres/${id}/activer/`),
};

export const clientsApi = {
  list: (params) => api.get("/clients/", params),
  create: (data) => api.post("/clients/", data),
  update: (id, data) => api.patch(`/clients/${id}/`, data),
  historique: (id) => api.get(`/clients/${id}/historique/`),
};

export const reservationsApi = {
  list: (params) => api.get("/reservations/", params),
  create: (data) => api.post("/reservations/", data),
  update: (id, data) => api.patch(`/reservations/${id}/`, data),
  confirmer: (id) => api.post(`/reservations/${id}/confirmer/`),
  annuler: (id) => api.post(`/reservations/${id}/annuler/`),
  terminer: (id) => api.post(`/reservations/${id}/terminer/`),
};

export const paiementsApi = {
  list: (params) => api.get("/paiements/", params),
  create: (data) => api.post("/paiements/", data),
};

export const rapportsApi = {
  dashboard: (params) => api.get("/dashboard/", params),
  reservations: (params) => api.get("/rapports/reservations/", params),
  paiements: (params) => api.get("/rapports/paiements/", params),
  revenus: (params) => api.get("/rapports/revenus/", params),
  exportCsv: (type, params) => api.download(`/rapports/${type}/`, { ...params, export: "csv" }),
};
