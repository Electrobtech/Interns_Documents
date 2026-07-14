// Small token store on top of localStorage. SSR-guarded so it is safe to call
// during the first render pass on the server.
const KEY = 'token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function setToken(token) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, token);
}

export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}

export function logout() {
  clearToken();
  if (typeof window !== 'undefined') window.location.href = '/login';
}
