const SITE = (typeof window !== 'undefined' ? (window as any).PUBLIC_SITE_URL : undefined) || import.meta.env.VITE_PUBLIC_SITE_URL || '';

export function makeTitle(parts: string[]): string {
	const base = parts.filter(Boolean).join(' · ');
	return truncate(base, 65);
}

export function makeDescription(text: string, max = 160): string {
	const clean = (text || '').replace(/\s+/g, ' ').trim();
	if (clean.length <= max) return clean;
	const slice = clean.slice(0, max);
	const lastSpace = slice.lastIndexOf(' ');
	return `${slice.slice(0, Math.max(0, lastSpace))}…`;
}

export function absoluteUrl(path: string): string {
	if (!SITE) return path;
	if (/^https?:\/\//i.test(path)) return path;
	return `${SITE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function ogTags(opts: { title: string; description: string; url: string; image: string }): Record<string, string> {
	return {
		'og:type': 'website',
		'og:title': truncate(opts.title, 65),
		'og:description': truncate(opts.description, 180),
		'og:url': opts.url,
		'og:image': opts.image,
		'og:site_name': 'StoneCaster',
	};
}

export function twitterTags(opts: { title: string; description: string; url: string; image: string; card?: 'summary' | 'summary_large_image' }): Record<string, string> {
	return {
		'twitter:card': opts.card ?? 'summary_large_image',
		'twitter:title': truncate(opts.title, 65),
		'twitter:description': truncate(opts.description, 180),
		'twitter:image': opts.image,
		'twitter:url': opts.url,
	};
}

function truncate(s: string, n: number): string {
	if (!s) return '';
	return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

export function upsertMeta(name: string, content: string) {
	let el = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
	if (!el) {
		el = document.createElement('meta');
		el.setAttribute('name', name);
		document.head.appendChild(el);
	}
	el.setAttribute('content', content);
}

export function upsertProperty(property: string, content: string) {
	let el = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
	if (!el) {
		el = document.createElement('meta');
		el.setAttribute('property', property);
		document.head.appendChild(el);
	}
	el.setAttribute('content', content);
}

export function upsertLink(rel: string, href: string) {
	let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
	if (!el) {
		el = document.createElement('link');
		el.setAttribute('rel', rel);
		document.head.appendChild(el);
	}
	el.setAttribute('href', href);
}

export function injectJSONLD(obj: unknown) {
	let el = document.head.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null;
	if (!el) {
		el = document.createElement('script');
		el.type = 'application/ld+json';
		document.head.appendChild(el);
	}
	el.text = JSON.stringify(obj);
}



