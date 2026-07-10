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
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

// Multipart/form-data variant of `api()`, for file uploads (e.g. the
// Message Node "document" badge in FlowBuilder.jsx). Deliberately does NOT
// set Content-Type itself — the browser needs to add the multipart
// boundary, which it only does when it builds the header itself.
export async function apiUpload(path, formData, { token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}
