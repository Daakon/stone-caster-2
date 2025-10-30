const STORAGE_KEY = 'guest_token';
const STORAGE_TS = 'guest_token_ts';
const TTL_HOURS = 6;

export async function ensureGuestToken(createGuestToken: () => Promise<{ ok: boolean; data?: { token: string } }>): Promise<string | null> {
	try {
		const now = Date.now();
		const tsRaw = localStorage.getItem(STORAGE_TS);
		const token = localStorage.getItem(STORAGE_KEY);
		if (tsRaw && token) {
			const ageMs = now - Number(tsRaw);
			if (ageMs < TTL_HOURS * 60 * 60 * 1000) {
				return token;
			}
		}
		const result = await createGuestToken();
		if (result.ok && result.data?.token) {
			localStorage.setItem(STORAGE_KEY, result.data.token);
			localStorage.setItem(STORAGE_TS, String(now));
			try { (window as any).__ANALYTICS__?.track?.('guest_token_refreshed'); } catch {}
			return result.data.token;
		}
		return null;
	} catch {
		return null;
	}
}




