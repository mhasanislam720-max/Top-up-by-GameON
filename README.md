# Game Top-Up BD — Production starter v3

React + Vite storefront connected to Supabase.

## Included
- Customer login/signup
- Game/package catalog
- Order creation protected by RLS + database trigger pricing
- Admin dashboard
- bKash Tokenized Checkout Edge Function flow
- bKash callback/execute flow
- GameCore fulfillment Edge Function + signed webhook receiver
- Idempotency fields and payment/provider hardening
- Capacitor configuration for Android builds

## Live activation
Set the following as **Supabase Edge Function secrets**, not browser environment variables:

- `BKASH_BASE_URL`
- `BKASH_APP_KEY`
- `BKASH_APP_SECRET`
- `BKASH_USERNAME`
- `BKASH_PASSWORD`
- `BKASH_CALLBACK_URL`
- `GAMECORE_API_KEY`
- `GAMECORE_BASE_URL`
- `GAMECORE_WEBHOOK_SECRET`
- `GAMECORE_INTERNAL_SECRET`
- `GAMECORE_CALLBACK_URL`
- `APP_SUCCESS_URL`
- `APP_FAILED_URL`

For GameCore, each product must have a numeric `provider_product_id` matching the provider catalog. The fulfillment function sends the player's ID as `deliveryData.gameUserId` and uses an idempotency key.

Nagad is intentionally not hard-coded to an unverified endpoint. The official merchant API onboarding/details are required before enabling live Nagad payments.

## Run
```bash
npm install
npm run dev
```

## Android
```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

Never put bKash/Nagad/provider secrets in Vite client env vars. Use Supabase Edge Function secrets.
