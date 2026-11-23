# Deploying POEAGE HUB to Vercel

One repository, **four Vercel projects** (shop, admin, vendor, driver). Each project builds one app folder.

## 1. Commit everything first

Vercel only sees what is on GitHub. The earlier build failed because some source folders were being ignored by
`.gitignore` (fixed) and the old `vercel.json` files were still on GitHub. Push the fixes:

```bash
git add -A
git status          # check that admin/src/lib/*.ts and vendor/src/lib/*.ts show as new files
git commit -m "Fix Vercel build: track src/lib, npm workspaces, Node 26, env templates"
git push
```

> `.env` files and `deploy/vercel.env` are git-ignored on purpose. Never commit service-account keys.

## 2. Create the four projects

Import the same GitHub repo four times. For each project:

| Project | Root Directory |
|---------|----------------|
| Shop    | `user`   |
| Admin   | `admin`  |
| Vendor  | `vendor` |
| Driver  | `driver` |

Leave **"Include source files outside of the Root Directory"** switched **on** (the apps share `packages/`).
Framework preset: **Vite** (already set in each `vercel.json`, which also sets the install and build commands:
`cd .. && npm ci` and `npm run build`). Node version comes from `package.json` → `engines`.

## 3. Environment variables

Open `deploy/vercel.env`, replace the four `YOUR-…-DOMAIN` lines with the real addresses, then in **each** Vercel
project go to *Settings → Environment Variables* and paste the whole file into the first field (Vercel splits it
into separate variables). The same values go into all four projects. Redeploy after changing variables.

## 4. Firebase settings

* **Authentication → Settings → Authorized domains**: add all four Vercel domains (needed for Google sign-in and
  password-reset links).
* Firestore security rules are published with `npx tsx scripts/deploy-rules.ts` (service-account key required;
  keep that key out of git).

## 5. Local development

Copy `.env.example` to `.env` in each app folder (the files already exist locally) and run `npm run dev`.
Ports: shop 5180, admin 5181, vendor 5182, driver 5183.
