import { describe, it, expect } from 'vitest';
import { makeTitle, makeDescription, absoluteUrl, ogTags, twitterTags } from './meta';

describe('meta utils', () => {
	it('makes title with truncation', () => {
		const t = makeTitle(Array(5).fill('Very Long Part That Might Overflow'));
		expect(t.length).toBeLessThanOrEqual(66);
	});
	it('makes safe description', () => {
		const d = makeDescription('word '.repeat(200), 160);
		expect(d.length).toBeLessThanOrEqual(161);
		expect(d.endsWith('…')).toBe(true);
	});
	it('absoluteUrl prefixes site', () => {
		const u = absoluteUrl('/stories/veil');
		expect(u).toMatch(/\/stories\/veil$/);
	});
	it('og/twitter tags include required fields', () => {
		const base = { title: 'T', description: 'D', url: 'https://x', image: 'https://img' };
		const og = ogTags(base);
		expect(og['og:title']).toBe('T');
		expect(og['og:image']).toBe('https://img');
		const tw = twitterTags(base);
		expect(tw['twitter:card']).toBe('summary_large_image');
		expect(tw['twitter:title']).toBe('T');
	});
});





