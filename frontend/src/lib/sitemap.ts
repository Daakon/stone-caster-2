/**
 * Sitemap generation utilities for StoneCaster
 * 
 * This module generates XML sitemaps for the catalog pages and individual items.
 * It only includes active content (no drafts or archived items).
 */

export interface SitemapItem {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface SitemapData {
  items: SitemapItem[];
  baseUrl: string;
}

/**
 * Generate XML sitemap from sitemap data
 */
export function generateSitemapXML(data: SitemapData): string {
  const { items, baseUrl } = data;
  
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const urlsetClose = '</urlset>';
  
  const urlEntries = items.map(item => {
    const url = item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`;
    
    let urlXml = `  <url>
    <loc>${escapeXml(url)}</loc>`;
    
    if (item.lastmod) {
      urlXml += `\n    <lastmod>${item.lastmod}</lastmod>`;
    }
    
    if (item.changefreq) {
      urlXml += `\n    <changefreq>${item.changefreq}</changefreq>`;
    }
    
    if (item.priority !== undefined) {
      urlXml += `\n    <priority>${item.priority}</priority>`;
    }
    
    urlXml += '\n  </url>';
    return urlXml;
  }).join('\n');
  
  return `${xmlHeader}
${urlsetOpen}
${urlEntries}
${urlsetClose}`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate sitemap for catalog pages
 */
export function generateCatalogSitemap(baseUrl: string): SitemapItem[] {
  const catalogPages = [
    { path: '/', priority: 1.0, changefreq: 'daily' as const },
    { path: '/stories', priority: 0.9, changefreq: 'daily' as const },
    { path: '/worlds', priority: 0.8, changefreq: 'weekly' as const },
    { path: '/npcs', priority: 0.7, changefreq: 'weekly' as const },
    { path: '/rulesets', priority: 0.7, changefreq: 'weekly' as const },
  ];
  
  return catalogPages.map(page => ({
    url: page.path,
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: page.changefreq,
    priority: page.priority,
  }));
}

/**
 * Generate sitemap for individual stories
 */
export function generateStoriesSitemap(stories: Array<{ id: string; slug?: string; updated_at?: string }>, baseUrl: string): SitemapItem[] {
  return stories.map(story => ({
    url: `/stories/${story.slug || story.id}`,
    lastmod: story.updated_at ? new Date(story.updated_at).toISOString().split('T')[0] : undefined,
    changefreq: 'weekly' as const,
    priority: 0.8,
  }));
}

/**
 * Generate sitemap for individual worlds
 */
export function generateWorldsSitemap(worlds: Array<{ id: string; slug?: string; updated_at?: string }>, baseUrl: string): SitemapItem[] {
  return worlds.map(world => ({
    url: `/worlds/${world.slug || world.id}`,
    lastmod: world.updated_at ? new Date(world.updated_at).toISOString().split('T')[0] : undefined,
    changefreq: 'monthly' as const,
    priority: 0.7,
  }));
}

/**
 * Generate sitemap for individual NPCs
 */
export function generateNPCsSitemap(npcs: Array<{ id: string; updated_at?: string }>, baseUrl: string): SitemapItem[] {
  return npcs.map(npc => ({
    url: `/npcs/${npc.id}`,
    lastmod: npc.updated_at ? new Date(npc.updated_at).toISOString().split('T')[0] : undefined,
    changefreq: 'monthly' as const,
    priority: 0.6,
  }));
}

/**
 * Generate sitemap for individual rulesets
 */
export function generateRulesetsSitemap(rulesets: Array<{ id: string; updated_at?: string }>, baseUrl: string): SitemapItem[] {
  return rulesets.map(ruleset => ({
    url: `/rulesets/${ruleset.id}`,
    lastmod: ruleset.updated_at ? new Date(ruleset.updated_at).toISOString().split('T')[0] : undefined,
    changefreq: 'monthly' as const,
    priority: 0.6,
  }));
}

/**
 * Generate complete sitemap with all content
 */
export function generateCompleteSitemap(
  data: {
    stories: Array<{ id: string; slug?: string; updated_at?: string }>;
    worlds: Array<{ id: string; slug?: string; updated_at?: string }>;
    npcs: Array<{ id: string; updated_at?: string }>;
    rulesets: Array<{ id: string; updated_at?: string }>;
  },
  baseUrl: string
): SitemapData {
  const catalogItems = generateCatalogSitemap(baseUrl);
  const storyItems = generateStoriesSitemap(data.stories, baseUrl);
  const worldItems = generateWorldsSitemap(data.worlds, baseUrl);
  const npcItems = generateNPCsSitemap(data.npcs, baseUrl);
  const rulesetItems = generateRulesetsSitemap(data.rulesets, baseUrl);
  
  return {
    items: [
      ...catalogItems,
      ...storyItems,
      ...worldItems,
      ...npcItems,
      ...rulesetItems,
    ],
    baseUrl,
  };
}
