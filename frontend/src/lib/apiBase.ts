/**
 * Single source of truth for API base URL
 * All API calls must go through localhost:3000 or api.stonecaster.ai
 */
export const API_BASE = (
  import.meta.env.VITE_API_BASE ?? (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai')
).replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`; // e.g. "/api/characters" -> "http://localhost:3000/api/characters"
}
