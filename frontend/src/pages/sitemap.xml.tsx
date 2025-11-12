import React from 'react';
import { generateCompleteSitemap } from '@/lib/sitemap';
import { useStories, useWorlds } from '@/lib/queries/index';
import { useNPCsQuery, useRulesetsQuery } from '@/lib/queries';

/**
 * Sitemap XML route component
 * 
 * This component generates a dynamic sitemap.xml that includes all active content.
 * It should be accessible at /sitemap.xml
 */
export default function SitemapXML() {
  // Load all content data - using canonical hooks
  const { data: stories = [] } = useStories({});
  const { data: worlds = [] } = useWorlds();
  const { data: npcs = [] } = useNPCsQuery({});
  const { data: rulesets = [] } = useRulesetsQuery();

  // Generate sitemap
  const baseUrl = process.env.REACT_APP_BASE_URL || 'https://stonecaster.com';
  const sitemapData = generateCompleteSitemap(
    {
      stories,
      worlds,
      npcs,
      rulesets,
    },
    baseUrl
  );

  // Generate XML
  const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapData.items.map(item => {
  const url = item.url.startsWith('http') ? item.url : `${sitemapData.baseUrl}${item.url}`;
  
  let urlXml = `  <url>
    <loc>${url}</loc>`;
  
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
}).join('\n')}
</urlset>`;

  // Return XML content
  return (
    <pre style={{ whiteSpace: 'pre-wrap' }}>
      {sitemapXML}
    </pre>
  );
}

// Set content type for XML response
export const getServerSideProps = async () => {
  return {
    props: {},
    headers: {
      'Content-Type': 'application/xml',
    },
  };
};
