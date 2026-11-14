# STORA — Changelog

## 3.0.0 — 2026-11-15
- STORA 3.0 is now the main app at /Stora/ (rebuilt from source in app/).
- The 2.x app is archived at /Stora/v2/; /Stora/beta/ redirects to /Stora/.
- Releases go through the cart; item page shows received / released / remaining / minimum; returns per release line; new home.


## v2.1 · November 2026

### Improvements
- **Phone layout:** the side menu becomes a slide-out drawer (☰ button in the header), content uses the full width,
  dashboard cards stack 2-up, popups open from the bottom, larger tap targets.
- **New users waiting for permissions:** marked "New — needs permissions" and listed first on the Users page,
  with a banner showing how many are waiting. Saving their role clears the mark.
- **New user's dashboard:** shows "Your account is ready — your manager will assign your role shortly" instead of an empty screen.
- **Super Admin** opens straight to the Companies page; the header shows "Super Admin".
- Dashboard date and greeting follow the selected language.

## v2.0 · November 2026

### Fixes
- **New users now appear for their manager.** Join codes always map to one fixed company id
  (`JEDCO001` → `company_002`, `ICAD0001`/`ICAD0000` → `company_1780749182580`), and the Users page
  lists everyone in the company, including people registered under older ids.
- Saving a user's role/storages moves them into the manager's company space so they see its data at once.
- Accounts left half-created (sign-in exists, profile missing) are completed by registering again with the same email, password and join code.
- The Users page no longer reads every user in the database.
- Deleting a storage also deletes its items (no orphans).
- A release can only contain items from one storage.
- Users limited to specific storages only see those storages' items; dashboard count fixed for unrestricted users.
- Super Admin can open Users, Logs and Reports; role labels fixed in Settings.
- Header and Users page always show the right company name and join code.
- Cache-busting `?v=2.0` on assets so browsers load the new version.

### New
- **Companies page** (Super Admin): create companies, generate / change / disable join codes, see users and managers per company.
  Codes are stored in `joinCodes/{CODE}` so they can be checked at sign-up without exposing the list.
- **Full Arabic interface** with right-to-left layout (`assets/stora-ext.js`), switching instantly with the language setting.
- **Offline support**: service worker (`sw.js`) keeps the app shell available; an indicator shows when the device is offline
  (Firestore already keeps data cached on the device).
- **Visual polish & light mode** (`assets/stora-theme.css`): softer cards, gradient primary buttons, smoother popups, better light theme.
- **Firestore security rules** (`firestore.rules`) — each company sees only its own data.

### Publishing the security rules
1. Firebase Console → Firestore Database → **Rules**.
2. Replace the content with `firestore.rules`, then **Publish**.
3. Test: sign in as a manager, open Users, Storages, Items, Reports; register a new user with the join code.
   If anything shows "permission denied", restore the previous rules from the Rules history tab.
