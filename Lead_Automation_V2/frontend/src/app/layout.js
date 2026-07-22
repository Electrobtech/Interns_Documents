import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Lead Automation — Electrobtech Innovations',
  description: 'Unified Customer Engagement & Revenue Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
