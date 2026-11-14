# STORA 3 — source

The new STORA front end (React + TypeScript + Vite). It uses the **same Firebase project and data** as STORA 2.x, so both versions can run side by side.

| Path | What |
|---|---|
| `src/config/` | App identity & feature flags (`app.ts`), Firebase (`firebase.ts`), built-in companies (`companies.ts`) |
| `src/services/` | All Firestore reads/writes (auth, inventory, releases, users, companies, audit) — UI never talks to Firestore directly |
| `src/state/` | Session, shared company data, release cart |
| `src/lib/` | Language/theme prefs, formatting, permissions, optional telemetry |
| `src/ui/` | Layout (sidebar on desktop, bottom bar on phone), icons, shared components |
| `src/pages/` | Screens |
| `src/styles/app.css` | Design tokens (dark/light) and styles |

## Run & build
```bash
cd app
npm install
npm run dev     # http://localhost:5173/Stora/beta/
npm run build   # outputs to ../beta (served at /Stora/beta/)
```
Pushing changes under `app/` to `main` rebuilds `beta/` automatically (GitHub Actions, free for public repos).

## Decisions
- **Same data model as 2.x** (collections, field names, company ids) — no migration needed.
- **Hash routing** so GitHub Pages works without server config.
- **Offline**: Firestore persistent cache + a service worker for the app shell.
- **Feature flags** in `config/app.ts` are the extension point for future Free/Pro editions.
- **Telemetry** (`lib/telemetry.ts`) is off; it only sends anonymous install id, version and device type when an endpoint is configured. The app never depends on it.
- **Security** is enforced by `firestore.rules` at the repo root, not by the client.
