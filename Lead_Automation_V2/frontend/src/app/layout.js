import './globals.css';
import Providers from './providers';

// Fonts previously came from next/font/google (Inter, Manrope), which
// downloads font files from Google's CDN at BUILD time and fails the whole
// `docker build` on networks that block/intercept fonts.gstatic.com (see the
// matching fix + longer explanation in app/home/layout.jsx). globals.css
// already falls back to system-ui/sans-serif whenever these CSS variables
// are unset (`font-family: var(--font-body), system-ui, sans-serif`), so
// setting them directly to a system-font stack — instead of via next/font —
// removes the build's network dependency without changing that fallback
// behavior.
const FONT_VARS = {
  '--font-body': "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  '--font-heading': "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export const metadata = {
  title: 'Orbq — Omnichannel Lead Automation Platform',
  description: 'Capture, qualify, route and nurture leads from WhatsApp, Instagram, LinkedIn, Email, SMS and Voice in one unified AI-powered workspace.',
  icons: {
    icon: '/orbq-icon.png',
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={FONT_VARS}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
