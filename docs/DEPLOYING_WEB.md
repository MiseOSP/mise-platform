# Deploying the Web Build (Expo Hosting)

Public URL: https://miseosp-mobile.expo.app

This guide publishes the Expo app as a hosted web build. First-time setup is
already done; on later visits you only need the "Redeploy" steps.

## What runs where
- App code lives in `apps/mobile` (single Expo app, uses **npm**).
- Hosting is Expo Hosting (EAS). Project: `@miseosp/mobile`.
- The web build reads Supabase creds from `apps/mobile/.env`.

## One-time setup (per fresh machine / Codespace)
1. Open a GitHub Codespace on the repo (branch you want to deploy).
2. In the terminal: `cd apps/mobile && npm install`
3. Create env file: `cp .env.example .env`
   Then edit `.env` and fill in (NO space after `=`):
   - `EXPO_PUBLIC_SUPABASE_URL=https://csdabrfpvitmhkycqzkv.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=<the legacy anon public key from Supabase>`
   (Supabase: Settings > API Keys > "Legacy anon, service_role" tab > copy the `anon public` key.)
4. Authenticate Expo without a password:
   - Create a Personal Access Token at https://expo.dev/accounts/miseosp/settings/access-tokens
   - In the terminal: `export EXPO_TOKEN=<paste token>`  (no space after `=`)
   - Verify: `npx eas-cli@latest whoami`  -> should print `miseosp`

## Redeploy (every time you want to update the live site)
From `apps/mobile`:
1. `export EXPO_TOKEN=<token>`   (tokens are per-session; set it again each new terminal)
2. `npx expo export --platform web`
3. `npx eas-cli@latest deploy --prod`

Then open https://miseosp-mobile.expo.app to confirm.

## Notes / gotchas
- If deploy fails once with "The specified bucket does not exist", just run the
  deploy command again — the second run succeeds (known first-run hiccup).
- No space is allowed after `=` in `.env` or in the `export EXPO_TOKEN=` line.
- `.env` is gitignored and must never be committed. The anon key is safe for the
  client (RLS enforced); never use the service_role key here.
- Current deployment points at the Mise-development (dev) database.
