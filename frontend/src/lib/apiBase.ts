const API_BASE = (
  import.meta.env.VITE_API_BASE ?? "https://api.stonecaster.ai"
).replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`; // e.g. "/api/characters" -> "https://stonecaster-api.fly.dev/api/characters"
}
