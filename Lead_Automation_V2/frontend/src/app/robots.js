import { SITE_URL } from '@/lib/seo';

// Next.js App Router convention: served automatically at /robots.txt.
// /app/** is the authenticated multi-tenant dashboard (leads, inbox,
// campaigns, etc.) and /super-admin is the internal ops console — neither
// is content any search engine should index (and both sit behind login
// anyway, so a crawler hitting them just wastes crawl budget on redirects
// to /login). /home, /login, /register are the genuinely public surface.
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/home', '/login', '/register'],
        disallow: ['/app', '/super-admin'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
