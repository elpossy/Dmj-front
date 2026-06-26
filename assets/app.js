// ═══════════════════════════════════════════
// DAMUNDJÉ — app.js
// Logique partagée : API, auth, utilitaires
// ═══════════════════════════════════════════

const API_URL = "http://127.0.0.1:8000";
// ⚠️ En production, remplace par l'URL de ton serveur Railway

// ── Stockage du token ────────────────────────
const Auth = {
  getToken()        { return localStorage.getItem("dmj_token"); },
  getUser()         { return JSON.parse(localStorage.getItem("dmj_user") || "null"); },
  setSession(token, user) {
    localStorage.setItem("dmj_token", token);
    localStorage.setItem("dmj_user", JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem("dmj_token");
    localStorage.removeItem("dmj_user");
  },
  isLoggedIn()      { return !!this.getToken(); },

  // Redirige vers login si pas connecté
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  }
};

// ── Appels API centralisés ───────────────────
const API = {

  async request(method, path, body = null, isFormData = false) {
    const headers = {};
    const token = Auth.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (!isFormData) headers["Content-Type"] = "application/json";

    const options = { method, headers };
    if (body) {
      options.body = isFormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${API_URL}${path}`, options);

    // Session expirée → déconnexion automatique
    if (res.status === 401) {
      Auth.clear();
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      // FastAPI retourne { detail: "message" } en cas d'erreur
      throw new Error(data.detail || "Erreur serveur");
    }

    return data;
  },

  get(path)              { return this.request("GET", path); },
  post(path, body)       { return this.request("POST", path, body); },
  patch(path, body)      { return this.request("PATCH", path, body); },
  delete(path)           { return this.request("DELETE", path); },
  upload(path, formData) { return this.request("POST", path, formData, true); },
  uploadPatch(path, formData) { return this.request("PATCH", path, formData, true); },
};

// ── Formatage ────────────────────────────────
const Format = {
  price(amount, currency = "XOF") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: 0
    }).format(amount);
  },

  date(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);

    if (diff < 60)     return "à l'instant";
    if (diff < 3600)   return `il y a ${Math.floor(diff/60)} min`;
    if (diff < 86400)  return `il y a ${Math.floor(diff/3600)}h`;
    if (diff < 604800) return `il y a ${Math.floor(diff/86400)}j`;
    return d.toLocaleDateString("fr-FR");
  },

  stars(rating) {
    const full  = Math.round(rating);
    return "★".repeat(full) + "☆".repeat(5 - full);
  },

  condition(code) {
    const map = {
      new:      "Neuf",
      like_new: "Comme neuf",
      good:     "Bon état",
      used:     "Usagé",
      damaged:  "Endommagé"
    };
    return map[code] || code;
  }
};

// ── Toast notifications ──────────────────────
const Toast = {
  container: null,

  init() {
    this.container = document.createElement("div");
    this.container.className = "toast-container";
    document.body.appendChild(this.container);
  },

  show(message, type = "success", duration = 3000) {
    if (!this.container) this.init();
    const icons = { success: "✅", error: "❌", warning: "⚠️" };
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  },

  success(msg) { this.show(msg, "success"); },
  error(msg)   { this.show(msg, "error", 4000); },
  warning(msg) { this.show(msg, "warning"); }
};

// ── Génération HTML d'une carte annonce ─────
function renderListingCard(listing) {
  const photo = listing.photos?.[0]
    ? `<img src="${listing.photos[0]}" alt="${listing.title}" loading="lazy">`
    : `<span>📦</span>`;

  return `
    <a class="listing-card" href="/listing.html?id=${listing.id}">
      <div class="listing-card-photo">${photo}</div>
      <div class="listing-card-body">
        <div class="listing-card-title">${listing.title}</div>
        <div class="listing-card-price">${Format.price(listing.price, listing.currency)}</div>
        <div class="listing-card-meta">
          <span>${listing.city || "—"}</span>
          <span>${Format.date(listing.created_at)}</span>
        </div>
      </div>
    </a>`;
}

// ── Enregistre un événement ML ───────────────
async function trackEvent(listing_id, event_type, query = null) {
  if (!Auth.isLoggedIn()) return;
  try {
    let path = `/api/recommendations/event?listing_id=${listing_id}&event_type=${event_type}`;
    if (query) path += `&query=${encodeURIComponent(query)}`;
    await API.post(path);
  } catch {
    // silencieux — le ML ne doit jamais bloquer l'UX
  }
}