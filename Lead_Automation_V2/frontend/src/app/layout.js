import './globals.css';
import Providers from './providers';
import { Inter, Manrope } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata = {
  title: 'ConnectSphere — Omnichannel Lead Automation Platform',
  description: 'Capture, qualify, route and nurture leads from WhatsApp, Instagram, LinkedIn, Email, SMS and Voice in one unified AI-powered workspace.',
  icons: {
    icon: '/logo-icon.jpg',
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
