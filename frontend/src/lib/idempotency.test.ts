import { describe, it, expect, vi } from 'vitest';
import { makeSessionKey, setStoredSessionId, getStoredSessionId, makeIdempotencyKey } from './idempotency';
import { useCreateSession } from '@/lib/queries';

vi.mock('@/lib/api', () => ({
	createSession: vi.fn((body: any, opts?: any) => Promise.resolve({ ok: true, data: { id: 's-1' }, body, opts })),
}));

vi.mock('@tanstack/react-query', () => ({
	useMutation: (def: any) => ({ mutateAsync: def.mutationFn }),
}));

describe('idempotency', () => {
	it('stores and retrieves session id by (story, character)', () => {
		const sid = 'sess-123';
		setStoredSessionId('story-1', 'char-1', sid);
		expect(getStoredSessionId('story-1', 'char-1')).toBe(sid);
	});

	it('generates stable keys', () => {
		expect(makeSessionKey('a', 'b')).toBe('session:a:b');
		expect(makeIdempotencyKey('a', 'b')).toBe('idem:a:b');
	});

	it('passes Idempotency-Key header to createSession', async () => {
		const hook = useCreateSession();
		const key = makeIdempotencyKey('st', 'ch');
		const res: any = await hook.mutateAsync({ body: { story_id: 'st', character_id: 'ch' }, opts: { headers: { 'Idempotency-Key': key } } });
		expect(res.opts.headers['Idempotency-Key']).toBe(key);
	});
});

