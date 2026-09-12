/**
 * The only place that talks to the API.
 *
 * The access token is kept in a module variable rather than localStorage, so a
 * script injected into the page cannot read it. The refresh token lives in an
 * httpOnly cookie the browser sends on its own, which is why every request sets
 * credentials: 'include'.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

let accessToken = null;
let onSessionEnded = () => {};

export function setAccessToken(token) {
  accessToken = token;
}

/** Lets the auth provider clear its state when a session cannot be revived. */
export function onSessionEnd(handler) {
  onSessionEnded = handler;
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error?.code;
    // Field-level messages from the server's validation, for showing on inputs.
    this.details = body?.error?.details;
  }
}

async function send(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  try {
    return await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers,
      credentials: 'include',
      body: isForm ? body : body && JSON.stringify(body),
    });
  } catch {
    // fetch only rejects when the request never reached the server. The
    // browser's own wording for this is "Failed to fetch", which tells a user
    // nothing, so say what actually happened.
    throw new ApiError(0, {
      error: {
        code: 'NETWORK_ERROR',
        message: 'Could not reach the server. Check your connection and try again.',
      },
    });
  }
}

// While one refresh is in flight, other 401s wait for it instead of each firing
// their own — otherwise a page loading five things at once would rotate the
// refresh token five times and trip the server's reuse detection.
let refreshing = null;

async function refreshAccessToken() {
  refreshing ??= (async () => {
    try {
      const res = await send('/auth/refresh', { method: 'POST' });
      if (!res.ok) return null;
      const { accessToken: token } = await res.json();
      setAccessToken(token);
      return token;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

/**
 * Makes a request, and on a 401 tries once to refresh the session and repeat it.
 * That is what keeps a 15-minute access token invisible to the user.
 */
export async function request(path, options = {}) {
  let res = await send(path, options);

  if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    const token = await refreshAccessToken();
    if (!token) {
      setAccessToken(null);
      onSessionEnded();
      throw new ApiError(401, await safeJson(res));
    }
    res = await send(path, options);
  }

  if (!res.ok) throw new ApiError(res.status, await safeJson(res));
  if (res.status === 204) return null;

  return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
}

async function safeJson(res) {
  try {
    return await res.clone().json();
  } catch {
    return null;
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload: (path, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(path, { method: 'POST', body: form, isForm: true });
  },
  /** Downloads a file the browser should save, carrying the auth header. */
  download: async (path, fallbackName) => {
    const res = await send(path);
    if (!res.ok) throw new ApiError(res.status, await safeJson(res));

    const disposition = res.headers.get('content-disposition') ?? '';
    const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await res.blob());

    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  },
};
