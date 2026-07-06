import './globals.css';

export const metadata = {
  title: 'Lead Automation — Electrobtech Innovations',
  description: 'Unified Customer Engagement & Revenue Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
