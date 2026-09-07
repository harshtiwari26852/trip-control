let csrfToken = null;

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function apiFetch(url, options = {}) {
  const { method = 'GET', body, headers: extraHeaders = {} } = options;

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = await getCsrfToken();
    extraHeaders['X-CSRF-Token'] = token;
  }

  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    extraHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: extraHeaders,
    ...options,
  });

  if (res.status === 403) {
    csrfToken = null;
    const retryToken = await getCsrfToken();
    extraHeaders['X-CSRF-Token'] = retryToken;
    return fetch(url, {
      method,
      credentials: 'same-origin',
      headers: extraHeaders,
      ...options,
    });
  }

  return res;
}

export function resetCsrf() {
  csrfToken = null;
}
