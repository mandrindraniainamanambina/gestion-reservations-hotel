// Client HTTP centralisé : jeton, erreurs normalisées, téléchargement de fichiers.
const BASE = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "hotel_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(status, data) {
    let message = "Une erreur est survenue.";
    const fieldErrors = {};
    if (data && typeof data === "object") {
      for (const [cle, valeur] of Object.entries(data)) {
        const texte = Array.isArray(valeur) ? valeur.join(" ") : typeof valeur === "string" ? valeur : JSON.stringify(valeur);
        if (cle === "detail" || cle === "non_field_errors") message = texte;
        else fieldErrors[cle] = texte;
      }
      if (!data.detail && !data.non_field_errors && Object.keys(fieldErrors).length) {
        message = "Veuillez corriger les champs signalés.";
      }
    }
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function buildUrl(path, params) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) qs.append(k, v);
  });
  const suffix = qs.toString();
  return `${BASE}${path}${suffix ? `?${suffix}` : ""}`;
}

async function request(path, { method = "GET", body, params, blob = false } = {}) {
  const token = tokenStore.get();
  const headers = { Accept: blob ? "*/*" : "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Token ${token}`;

  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { detail: "Impossible de joindre le serveur." });
  }

  if (response.status === 401 && token) {
    tokenStore.clear();
    onUnauthorized();
  }
  if (response.status === 204) return null;
  if (blob && response.ok) return response.blob();
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body = {}) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  download: (path, params) => request(path, { params, blob: true }),
};

export function telecharger(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}
