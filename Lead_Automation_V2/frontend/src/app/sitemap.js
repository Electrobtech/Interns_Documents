import { SITE_URL } from '@/lib/seo';

// Next.js App Router convention: a default-exported function here is
// automatically served at /sitemap.xml — no manual XML, no separate route
// handler. Only lists genuinely public, indexable routes: the authenticated
// dashboard (/app/**) and /super-admin are deliberately excluded (see
// robots.js's matching Disallow rules) since a sitemap is a "please index
// this" list, not just an inventory of every route that exists.
export default function sitemap() {
  const now = new Date();

  return [
    { url: `${SITE_URL}/home`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
