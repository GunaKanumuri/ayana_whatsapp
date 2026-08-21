import axios from "axios";

// Fall back to local dev server so missing env var never causes cryptic failures.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
export const API = `${BACKEND_URL}/api`;

// Use the fetch adapter (axios' default XHR transport intermittently hangs on
// the very first request behind this ingress); short timeout so retries recover.
export const api = axios.create({ baseURL: API, adapter: "fetch", timeout: 6000, withCredentials: true });

// Auth tokens are sent via HttpOnly, Secure, SameSite=Strict cookies (set by
// the backend on login/register/refresh). withCredentials: true on the axios
// instance ensures the browser includes them on every API request. No manual
// Authorization header is needed — tokens cannot be read by JS (XSS-safe).
// The Bearer-header path still works server-side for non-browser clients.
/* api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ayana_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}); */

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("ayana_refresh_token");
      if (!refreshToken) {
        localStorage.removeItem("ayana_token");
        localStorage.removeItem("ayana_refresh_token");
        isRefreshing = false;
        processQueue(error, null);
        return Promise.reject(error);
      }

      try {
        const { data } = await api.post("/auth/refresh", {}, {
          headers: { Authorization: `Bearer ${refreshToken}` }
        });
        localStorage.setItem("ayana_token", data.access_token);
        localStorage.setItem("ayana_refresh_token", data.refresh_token);
        isRefreshing = false;
        processQueue(null, data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("ayana_token");
        localStorage.removeItem("ayana_refresh_token");
        isRefreshing = false;
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Turn a field path like ["body", "habits", "wake_time"] into "Wake time".
function humanizeField(loc) {
  const field = Array.isArray(loc) ? loc[loc.length - 1] : null;
  if (typeof field !== "string") return null;
  return field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Rewrite a single raw pydantic error into something a non-technical user
// can act on, instead of dumping the validator's regex/type internals.
function friendlyValidationMessage(e) {
  const label = humanizeField(e?.loc) || "A field";
  const msg = typeof e?.msg === "string" ? e.msg : "";
  if (/match pattern/i.test(msg)) {
    // Covers time-of-day fields (HH:MM) and similar pattern validators.
    return `${label} isn't a valid value — check the format or leave it blank.`;
  }
  if (/field required|missing/i.test(msg) || e?.type === "missing") {
    return `${label} is required.`;
  }
  if (msg) return `${label}: ${msg}`;
  return `${label} isn't valid.`;
}

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const seen = new Set();
    const messages = [];
    for (const e of detail) {
      const friendly = e && typeof e === "object" ? friendlyValidationMessage(e) : String(e);
      if (friendly && !seen.has(friendly)) {
        seen.add(friendly);
        messages.push(friendly);
      }
    }
    return messages.length ? messages.join(" ") : "Please check your input and try again.";
  }
  if (detail && typeof detail === "object") {
    // Shape returned by /payment/checkout when a downgrade doesn't fit
    // current usage: { message, blockers: [...], usage: {...} }.
    if (Array.isArray(detail.blockers) && detail.blockers.length) {
      const intro = typeof detail.message === "string" ? detail.message : "This change needs some cleanup first:";
      return [intro, ...detail.blockers.map((b) => `• ${b}`)].join("\n");
    }
    if (typeof detail.message === "string") return detail.message;
    if (typeof detail.msg === "string") return detail.msg;
  }
  return String(detail);
}