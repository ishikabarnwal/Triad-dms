import axios from "axios";

const TOKEN_KEY = "triad_dms_token";

// localStorage can throw in private windows or when storage is blocked; the app should still work.
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Without storage the session simply won't survive a reload.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing stored, nothing to clear.
    }
  },
};

const client = axios.create({ baseURL: "/api" });

let unauthorizedHandler = null;

/** Called by AuthContext so a 401 anywhere logs the user out and sends them to /login. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

client.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    // A wrong password on the login form is a 401 too, but that must not trigger a logout.
    const isCredentialCheck = url.startsWith("/auth/login") || url.startsWith("/auth/register");
    if (error.response?.status === 401 && !isCredentialCheck) {
      tokenStore.clear();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

/**
 * Normalise an API error into { status, code, message, fieldErrors, data }.
 * fieldErrors maps a field name to the first message the API gave for it.
 */
export function errorInfo(error) {
  const response = error?.response;
  const data = response?.data || {};
  const fieldErrors = {};
  for (const detail of data.details || []) {
    if (detail.field && !fieldErrors[detail.field]) {
      fieldErrors[detail.field] = detail.message;
    }
  }
  let message = data.message;
  if (!message) {
    message = response ? "Something went wrong. Please try again." : "Can't reach the server. Is the backend running?";
  }
  return { status: response?.status, code: data.error, message, fieldErrors, data };
}

/** errorInfo for requests made with responseType "blob", whose JSON error bodies arrive as a Blob. */
export async function blobErrorInfo(error) {
  const data = error?.response?.data;
  if (!(data instanceof Blob)) {
    return errorInfo(error);
  }
  try {
    return errorInfo({ response: { ...error.response, data: JSON.parse(await data.text()) } });
  } catch {
    return errorInfo({ response: { ...error.response, data: {} } });
  }
}

export default client;
