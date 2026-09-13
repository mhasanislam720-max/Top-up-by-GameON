# Game Top-Up BD — Deploy Ready

## Vercel
1. Upload this project to a GitHub repository.
2. Import the repository into Vercel.
3. Add these environment variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_PUBLISHABLE_KEY
4. Deploy.
5. In Supabase Authentication → URL Configuration, add your Vercel domain to Site URL / Redirect URLs.

## Local test
npm install
npm run build

## Important
Do not put Supabase secret/service-role keys, bKash secrets, Nagad secrets, or GameCore API keys in the frontend.
Those belong in Supabase Edge Function Secrets.
