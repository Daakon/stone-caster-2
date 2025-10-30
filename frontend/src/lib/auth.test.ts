import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureGuestToken } from './auth';

declare const localStorage: Storage;

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
});

describe('ensureGuestToken', () => {
	it('returns existing non-expired token without refresh', async () => {
		localStorage.setItem('guest_token', 'tok');
		localStorage.setItem('guest_token_ts', String(Date.now()));
		const create = vi.fn();
		const token = await ensureGuestToken(async () => ({ ok: true, data: { token: 'new' } }));
		expect(token).toBe('tok');
		expect(create).not.toHaveBeenCalled();
	});

	it('refreshes when expired and stores new token', async () => {
		localStorage.setItem('guest_token', 'old');
		localStorage.setItem('guest_token_ts', String(Date.now() - 7 * 60 * 60 * 1000));
		const create = vi.fn().mockResolvedValue({ ok: true, data: { token: 'fresh' } });
		const token = await ensureGuestToken(create);
		expect(create).toHaveBeenCalledOnce();
		expect(token).toBe('fresh');
		expect(localStorage.getItem('guest_token')).toBe('fresh');
	});

	it('handles refresh failure gracefully', async () => {
		localStorage.setItem('guest_token_ts', String(Date.now() - 7 * 60 * 60 * 1000));
		const create = vi.fn().mockResolvedValue({ ok: false });
		const token = await ensureGuestToken(create);
		expect(token).toBeNull();
	});
});





