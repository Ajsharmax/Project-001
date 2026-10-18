# Markettech deployment and administration

Target: **https://soft.markettech.in**. Preserve the existing apex domain, www, mail hostnames, MX, SPF, DKIM and DMARC records. This project is separate from the existing markettech deployment.

## Cloudflare Pages

Connect Ajsharmax/Project-001 to a new Pages project named `markettech-soft` in the account containing markettech.in. Build: `npm run build`; output: `dist`; Node: 24. The checked-in public production URL is not a secret. Set the custom domain to soft.markettech.in in Pages before configuring its DNS record. Preview deployments must not be bound to the production store database or real payment credentials.

The build bundles `server/worker.js` as `dist/_worker.js`. `_routes.json` invokes it only for `/api/*`. PDF processing and vendor assets stay in the browser; the commerce API uses D1. `_headers` applies CSP, referrer and MIME protections to static assets.

## Store database

Create D1 database `markettech-store`, execute `migrations/0001_store.sql`, and bind it to the Pages production deployment as **DB**. Redeploy after changing bindings. No products or paid plans are seeded. Without DB, the free website works and commerce remains unavailable.

## Owner sign-in (required for admin)

Create a Cloudflare Access self-hosted application covering **soft.markettech.in/admin** and **soft.markettech.in/api/admin/**. Allow only the owner's email; do not use an Everyone policy. Configure the following production variables:

- `ACCESS_TEAM_DOMAIN`: your actual `<team>.cloudflareaccess.com` hostname, no scheme.
- `ACCESS_AUD`: this Access application's audience ID.
- `ADMIN_EMAIL`: exact owner email allowed by the Access policy.

The server verifies the Access JWT signature, issuer, audience, expiry and exact owner email. It never trusts the email header alone and fails closed if configuration is absent. A public pages.dev alias cannot bypass the API verification. `/admin` is a public HTML shell until Access is configured, but no private data is served without valid server authorization. Hide no security controls in frontend code.

In `/admin`, add draft products, HTTPS image URLs, optional Flipkart/Meesho listing links, stock and prices. Create optional memberships with a price, duration and explicit benefits. Publish only real items. Memberships are **manual-renewal, one-time UPI purchases**, not UPI AutoPay; the existing free tools are never paywalled. The admin records membership validity and delivery status. No customer password account or automatic email notification service is implemented.

## YouPI-PG integration

Adapter based on the public REST contract and source at https://github.com/youpi-pg/YouPI-PG. No upstream implementation is copied or vendored. At inspection, README mentioned commercial/sovereign licensing but the linked LICENSE returned 404; obtain explicit deployment licence terms before operating that gateway.

YouPI-PG needs a persistent Node.js host with SQLite and configured bank SMS/Gmail/Android observers. It does not run inside this Pages Function. Arrange an appropriate host, merchant receiving VPA, verified observation channel and protected gateway administration separately. Never expose the control center or observer management without authentication. Do not assume marketing claims guarantee correct bank settlement.

Configure production secrets/variables in Cloudflare (never `VITE_*`):

- `YOUPI_API_URL`: HTTPS gateway API origin.
- `YOUPI_CHECKOUT_ORIGIN`: exact HTTPS checkout origin allowed for redirects.
- `YOUPI_MERCHANT_ID`: configured merchant identifier.
- `YOUPI_WEBHOOK_SECRET`: strong shared webhook secret, saved as an encrypted secret.

Set the merchant webhook URL to `https://soft.markettech.in/api/payments/webhook`.

The server calculates the amount from the database, creates an order and one gateway session with an idempotency key, and returns an allowlisted hosted-checkout URL. Raw webhook bytes are HMAC-SHA256 verified before parsing; payment ID, amount and UTR must match. UTR and payment IDs are unique. The redirect or browser result can never mark an order paid. Order status is readable only with the random capability token retained in that tab's session storage. Owner support can locate orders when the customer has lost the tab.

Stock is reserved once at checkout. Failed, expired and ambiguous sessions retain reservations for manual reconciliation; do not restock until you establish the payment cannot still settle. The current admin does not perform bank refunds or automatically release abandoned reservations. Reconcile before adjusting stock. Automated reconciliation, cancellation/refund workflows, tax invoicing and courier integration are follow-up requirements before scaling direct sales.

Before enabling checkout, publish the real support address, shipping, returns and terms in admin, configure the gateway and verify a real end-to-end payment with the owner. Checkout defaults off. Keep it off until merchant setup, licence, fulfillment and applicable business requirements are resolved. Opening payment collection is a separate operational step from deploying free tools.

## Verification

`npm ci`, `npm test`, `npm run build`, `npm run format:check`.
For a local backend: `npx wrangler d1 execute markettech-store --local --file=migrations/0001_store.sql`, then `npm run preview:cloudflare`. Use an isolated test DB and fake gateway for automated tests. Do not use live customer data in fixtures. Keep `.dev.vars`, `.env`, `.wrangler` and credentials out of Git.

Back up D1 and export order records through controlled owner access before production schema changes. Keep personal order data only as long as needed for fulfillment and applicable retention requirements. The original PDF-only privacy statement has been updated to distinguish local document processing from server-side commerce records.
