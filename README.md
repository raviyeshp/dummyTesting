# Computer Parivaar

A first runnable implementation of the ecommerce PRD: responsive storefront and shop administration, with a dependency-free Node.js API and a local JSON data store.

## Run

Requires Node.js 22 or newer.

```sh
npm start
```

Open http://127.0.0.1:3000. Select **Shop admin** for management screens. `npm run dev` restarts the server when source files change.

## Implemented

- Catalog search, category/brand/price/availability filters, product details, stock badges.
- Guest cart persisted in the browser, quantity adjustment, percentage/fixed coupons, server-calculated totals.
- Demo checkout with address validation, stock deductions, order confirmation and tracking on the originating browser.
- Admin dashboard, product creation/editing/visibility, inventory editing, customer list, coupon creation and order processing.
- Sequential order status progression and cancellation with stock restoration.
- Server-side persistence in `data/store.json`; API mutations are serialized to avoid concurrent stock overselling within one server process.
- Responsive desktop and mobile styling, native dialogs and form controls, inline product illustrations.

## Development boundaries

This is a local development application. The server deliberately binds to loopback. **There is no authentication or authorization** and the local API returns all demo orders/customer data. Do not expose it to a network or enter real personal information. UPI/card options are simulations; they do not collect or verify payment. COD also creates a demo order, not a real purchase. Data is a local JSON file, not a production database. Use a single Node process.

Next milestones: PostgreSQL schema and migrations; owner/staff sessions and customer OTP; private order access; payment provider/webhook verification; image uploads and variants; address book and wishlist; invoices, notifications, shipping/tax settings, coupon expiry/usage rules; production integration tests and deployment. Product prices/specifications are sample fixtures, not current retail offers. Google Fonts is optional; system fonts work offline.

## Project structure

- `server.js`: local HTTP server, API, validation and persistence.
- `public/app.js`: storefront/admin interface and browser state.
- `public/style.css`: responsive Clean Tech design system.
- `public/index.html`: application shell.

## Verification

```sh
node --check server.js
node --check public/app.js
npm test
```

The API smoke test uses a separate temporary data directory and port and does not change your shop data.
