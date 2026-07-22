# Inzyte agency bridge

This directory is the durable source for the private CRM-to-Inzyte bridge that
is deployed into the existing Inzyte Node service.

- `server/routes/agency.js` authenticates only the CRM edge function, selects a
  real Inzyte workspace, exposes a sanitized catalog, creates Google OAuth URLs,
  adds per-customer Search Console/GBP/Ads overrides and mounts the complete
  existing Inzyte API below `/api/v1/agency`.
- `server/utils/oauth-return.js` returns OAuth popups to the CRM without opening
  the Inzyte dashboard.

The production Inzyte service also contains small integration points:

1. `server/index.js` mounts `./routes/agency` at `/agency` in the v1 router.
2. `server/middleware/supabase-auth.js` accepts a previously authenticated
   `req.isAgency` request and bypasses the subscription check for that request.
3. The Search Console, Business Profile and Google Ads utility functions accept
   explicit per-request identifiers instead of relying only on a user's global
   selection.
4. Google OAuth callbacks call `sendAgencyOAuthResult` when their encrypted
   state contains an allow-listed `returnOrigin`.

`CRM_AGENCY_SECRET` is configured only in the Inzyte server environment and the
CRM Supabase function secret store. It must never be committed.
