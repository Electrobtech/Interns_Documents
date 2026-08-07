// src/lib/seo.js
//
// Single source of truth for the public marketing site's canonical base
// URL — used by src/app/home/layout.jsx (openGraph/canonical), and by
// src/app/sitemap.js + src/app/robots.js so all three can never disagree
// about what domain this deployment is actually live on.
//
// NEXT_PUBLIC_SITE_URL must be set to the real public hostname before
// going live (same requirement as AUTOMATION_PUBLIC_URL for media uploads
// — see .env.example) — canonical tags and sitemap entries pointing at
// localhost are worse for SEO than not having them at all, since they
// actively tell search engines the wrong canonical location.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
