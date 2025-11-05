export interface Env {}

function svg(title: string, subtitle: string) {
	const safeTitle = (title || '').slice(0, 42);
	const safeSub = (subtitle || '').slice(0, 48);
	return `<?xml version="1.0" encoding="UTF-8"?>
	<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
		<defs>
			<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
				<stop offset="0%" stop-color="#0f172a"/>
				<stop offset="100%" stop-color="#1e293b"/>
			</linearGradient>
		</defs>
		<rect width="1200" height="630" fill="url(#g)"/>
		<text x="60" y="360" fill="#e2e8f0" font-family="Inter, ui-sans-serif" font-size="72" font-weight="700">${safeTitle}</text>
		<text x="60" y="440" fill="#94a3b8" font-family="Inter, ui-sans-serif" font-size="36">${safeSub}</text>
		<circle cx="1120" cy="80" r="24" fill="#6366f1"/>
	</svg>`;
}

function hash(str: string): string {
	let h = 0;
	for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
	return `W/\"${h.toString(16)}\"`;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			const url = new URL(request.url);
			const parts = url.pathname.split('/').filter(Boolean);
			// /og/<type>/<id>
			const type = parts[1];
			const id = parts.slice(2).join('/');

			const title = decodeURIComponent(id || 'StoneCaster');
			const subtitle = type === 'story' ? 'Story · StoneCaster' : type === 'world' ? 'World · StoneCaster' : type === 'npc' ? 'Character · StoneCaster' : type === 'ruleset' ? 'Ruleset · StoneCaster' : 'StoneCaster';
			const body = svg(title, subtitle);
			const etag = hash(body);
			if (request.headers.get('if-none-match') === etag) {
				return new Response(null, { status: 304, headers: { 'Cache-Control': 'public, max-age=86400', ETag: etag } });
			}
			return new Response(body, {
				status: 200,
				headers: {
					'content-type': 'image/svg+xml; charset=utf-8',
					'cache-control': 'public, max-age=86400',
					ETag: etag,
				},
			});
		} catch (e) {
			return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"/>', {
				status: 200,
				headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' },
			});
		}
	},
};







