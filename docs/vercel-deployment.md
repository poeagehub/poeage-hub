# Vercel deployment

Import the same Git repository into four Vercel projects:

| Project | Root Directory | Framework | Build Command | Output Directory |
| --- | --- | --- | --- | --- |
| poeage-user | user | Vite | pnpm run build | dist |
| poeage-admin | admin | Vite | pnpm run build | dist |
| poeage-vendor | vendor | Vite | pnpm run build | dist |
| poeage-driver | driver | Vite | pnpm run build | dist |

Enable **Include source files outside of the Root Directory in the Build Step** for each project. The apps import shared workspace packages from `packages/`. Keep the entire repository available; do not upload only an app folder. Use pnpm for dependency installation (Vercel can detect `pnpm-lock.yaml`).

Each app includes `vercel.json` with its build settings and a rewrite to `index.html` for client-side routes.

## Environment variables

Import each app's local `.env` values into that Vercel project's Environment Variables. Local `.env` files are ignored by Git and will not be available in a Git deployment. Templates are in each app's `.env.example`.

- Set the Firebase values from the corresponding web app registration in Firebase project `poeage-hub-11`.
- Keep `VITE_USE_EMULATORS=false` for hosted deployments.
- Replace all four `VITE_*_APP_URL` localhost values with the deployed HTTPS URLs in every Vercel project, then redeploy.
- Values prefixed with `VITE_` are included in the browser bundle. Keep server credentials such as Razorpay secrets and service-account keys outside these frontend variables.
- Apply variables to the intended Production and Preview environments. Changing build-time variables requires a new deployment.

## Firebase backend

Vercel hosts the four frontend apps. It does not deploy the `functions/` Firebase backend, Firestore rules/indexes, or Storage rules. Configure Firebase Authentication providers, Firestore, and Storage and deploy the backend separately to `poeage-hub-11` before validating end-to-end workflows. The current `.firebaserc` still references the old development project; use an explicit `--project poeage-hub-11` for backend deployment until it is updated.

Add each deployed app hostname to Firebase Authentication's Authorized domains for sign-in flows that require it. Verify real sign-in, role permissions, data reads/writes, uploads, and callable functions after deployment. Successful frontend builds alone do not verify Firebase connectivity.
