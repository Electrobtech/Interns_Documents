// Fonts previously came from next/font/google (Inter, Space Grotesk,
// JetBrains Mono), which downloads font files from Google's CDN at BUILD
// time. On networks that block/intercept fonts.gstatic.com (common behind
// corporate proxies/AV — see the NODE_TLS_REJECT_UNAUTHORIZED workaround in
// frontend.Dockerfile for the same class of issue with npm), that build-time
// fetch fails and `docker build` dies entirely, even though nothing here is
// actually served at runtime from Google. Switched to a system-font stack so
// the build never touches the network for typography. Of the three fonts
// only Inter was ever applied (Space Grotesk / JetBrains Mono were declared
// as CSS variables but not consumed by any component), so this is a
// same-page-only visual change, not a functional one.
export const metadata = {
  title: 'LeadForge — AI-powered lead automation & CRM',
};

const SYSTEM_SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Fonts are scoped to this route via the style prop below — the rest
// of the app (the (app) group) is untouched.
export default function HomeLayout({ children }) {
  return (
    <div style={{ fontFamily: SYSTEM_SANS }}>
      {children}
    </div>
  );
}
