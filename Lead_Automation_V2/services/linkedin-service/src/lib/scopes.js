// LinkedIn scopes, tiered by which LinkedIn Products they belong to — each
// tier is requested only if that Product has actually been approved for this
// app, so the OAuth request never asks for a scope LinkedIn will reject.
//
// CORE_SCOPES — "Sign In with LinkedIn (OpenID Connect)" + "Share on
// LinkedIn". Self-serve, instant, no review.
//   openid/profile/email  -> identity (replaces the deprecated r_liteprofile)
//   w_member_social       -> post, and read back what YOU posted, as the member
//
// ADS_SCOPES — "Advertising API" + "Lead Sync API" + "Conversions API"
// Products. Each needs a LinkedIn business review, but once approved the
// scopes work like any other — controlled by LINKEDIN_ADS_ACCESS.
//
// ORG_SCOPES — "Community Management API" Product: posting/reading/reacting
// as an ORGANIZATION page (not you personally). A separate review from Ads.
// Controlled by LINKEDIN_ORG_ACCESS.
export const CORE_SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

export const ADS_SCOPES = [
  'r_ads',                    // read ad accounts/campaigns
  'rw_ads',                   // create/manage ad campaigns
  'r_ads_reporting',          // campaign performance metrics
  'r_ads_leadgen_automation', // Lead Sync API — lead gen form sync
  'rw_conversions',           // Conversions API — offline/website conversion events
];

export const ORG_SCOPES = [
  'r_organization_social',   // read organization posts/comments/reactions
  'w_organization_social',   // post as an organization page
  'rw_organization_admin',   // manage organization page + Community Management API
];

// Kept for anything still checking "is this scope partner-gated at all".
export const PARTNER_SCOPES = [...ADS_SCOPES, ...ORG_SCOPES];

export function hasAdsAccess() {
  return String(process.env.LINKEDIN_ADS_ACCESS ?? 'true').toLowerCase() === 'true';
}
export function hasOrgAccess() {
  return String(process.env.LINKEDIN_ORG_ACCESS ?? 'false').toLowerCase() === 'true';
}
// Back-compat alias — "partner access" now means "any gated tier enabled".
export function hasPartnerAccess() {
  return hasAdsAccess() || hasOrgAccess();
}

export function requestedScopes() {
  return [
    ...CORE_SCOPES,
    ...(hasAdsAccess() ? ADS_SCOPES : []),
    ...(hasOrgAccess() ? ORG_SCOPES : []),
  ];
}

// Express middleware factory — 403s with a clear, structured reason when the
// connected account is missing a scope that needs partner approval, instead
// of letting the LinkedIn API call fail with an opaque 403 further down.
export function requireScope(scope) {
  return (req, res, next) => {
    const granted = req.linkedinConnection?.granted_scopes || [];
    if (granted.includes(scope)) return next();
    const isOrg = ORG_SCOPES.includes(scope);
    const isAds = ADS_SCOPES.includes(scope);
    return res.status(403).json({
      error: (isOrg || isAds) ? 'linkedin_partner_access_required' : 'linkedin_scope_missing',
      scope,
      message: isOrg
        ? `This action needs LinkedIn's "${scope}" scope, which requires Community Management API approval. Apply for that Product, then reconnect LinkedIn.`
        : isAds
          ? `This action needs LinkedIn's "${scope}" scope. If your Advertising/Lead Sync/Conversions Products are approved, reconnect LinkedIn to re-grant scopes; otherwise apply for the relevant Product first.`
          : `Reconnect LinkedIn to grant the "${scope}" scope.`,
    });
  };
}
