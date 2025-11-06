export function makeSessionKey(storyId: string, characterId: string): string {
	return `session:${storyId}:${characterId}`;
}

export function getStoredSessionId(storyId: string, characterId: string): string | null {
	try {
		const key = makeSessionKey(storyId, characterId);
		return sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

export function setStoredSessionId(storyId: string, characterId: string, sessionId: string): void {
	try {
		const key = makeSessionKey(storyId, characterId);
		sessionStorage.setItem(key, sessionId);
	} catch {
		// ignore storage failures (private mode, etc.)
	}
}

export function makeIdempotencyKey(storyId: string, characterId: string): string {
	// Stable, unique per (story, character) and day window to avoid unbounded storage
	const base = `${storyId}:${characterId}`;
	return `idem:${base}`;
}

// Phase 5: Generate v4 UUID idempotency key for game creation
export function generateIdempotencyKeyV4(): string {
	// Use crypto.randomUUID() if available (browsers), fallback to timestamp + random
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for environments without crypto.randomUUID
	return `idem-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

