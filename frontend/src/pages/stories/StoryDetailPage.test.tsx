import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import StoryDetailPage from './StoryDetailPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/lib/queries', () => ({
	useStoryQuery: () => ({ isLoading: false, data: { data: { title: 'The Veil', slug: 'the-veil', world_name: 'Mystika', short_desc: 'A veil between worlds.', updated_at: '2024-01-01T00:00:00Z' } } }),
}));

describe('StoryDetailPage meta', () => {
	it('injects title, description, OG/Twitter, canonical, and JSON-LD', () => {
		render(
			<MemoryRouter initialEntries={["/stories/the-veil"]}>
				<Routes>
					<Route path="/stories/:id" element={<StoryDetailPage />} />
				</Routes>
			</MemoryRouter>
		);
		expect(document.title).toMatch(/The Veil/);
		const desc = document.head.querySelector('meta[name="description"]') as HTMLMetaElement;
		expect(desc?.content).toMatch(/veil/i);
		const ogTitle = document.head.querySelector('meta[property="og:title"]') as HTMLMetaElement;
		expect(ogTitle?.content).toMatch(/The Veil/);
		const twTitle = document.head.querySelector('meta[name="twitter:title"]') as HTMLMetaElement;
		expect(twTitle?.content).toMatch(/The Veil/);
		const canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement;
		expect(canonical?.href).toMatch(/\/stories\/the-veil/);
		const jsonLd = document.head.querySelector('script[type="application/ld+json"]') as HTMLScriptElement;
		const obj = JSON.parse(jsonLd?.text || '{}');
		expect(obj['@type']).toBe('CreativeWork');
		expect(obj.name).toBe('The Veil');
	});
});







