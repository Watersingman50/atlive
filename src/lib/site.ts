// Canonical production origin. Used for sitemap, robots, canonical tags, OG,
// JSON-LD, and the email confirm/unsubscribe links. Single source so the
// absolute-URL story is consistent.
//
// Domain switch is one env var: set NEXT_PUBLIC_SITE_URL to the custom domain
// (e.g. https://atlive.com) in Vercel + GitHub Actions secrets and everything
// — canonicals, sitemap, OG, email links — follows. Falls back to the Vercel
// URL until then. Trailing slash trimmed so `${SITE_URL}/path` never doubles up.
// `|| `, not `??`: an unset GitHub Actions secret expands to "" (empty string,
// not undefined), and "" must still fall back to the default — otherwise every
// absolute URL would break in CI.
const RAW = (process.env.NEXT_PUBLIC_SITE_URL || "").trim() || "https://atlive.vercel.app";
export const SITE_URL = RAW.replace(/\/+$/, "");
