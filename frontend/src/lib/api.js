const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    // Some services (e.g. integration-service's publish routes) return a
    // structured shape ({category, message, retryable, httpStatus}) rather
    // than {error}. Keep .message behavior unchanged for existing callers,
    // but also attach the full body + status so callers that need the
    // extra fields (e.g. "retryable") can read err.data.
    const err = new Error(errBody.error || errBody.message || res.statusText);
    err.status = res.status;
    err.data = errBody;
    throw err;
  }
  return res.json();
}
