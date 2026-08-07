import { SITE_URL } from '@/lib/seo';

// schema.org JSON-LD for the landing page — gives search engines an
// unambiguous, machine-readable description of what LeadForge is (a
// SoftwareApplication) and who publishes it (an Organization), which is
// what powers rich results (sitelinks search box, knowledge-panel-style
// snippets) rather than Google having to infer it from prose alone.
// Rendered server-side as a plain <script> tag — no client JS, so it costs
// nothing at runtime and is present in the initial HTML for crawlers that
// don't execute JavaScript.
export default function StructuredData() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/home#organization`,
        name: 'Electrobtech Innovations Pvt Ltd',
        url: SITE_URL,
        logo: `${SITE_URL}/orbq-icon.png`,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'LeadForge',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'Capture, qualify, route and nurture leads from WhatsApp, Instagram, Messenger, Email, SMS and Voice in one unified AI-powered workspace.',
        url: `${SITE_URL}/home`,
        publisher: { '@id': `${SITE_URL}/home#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
