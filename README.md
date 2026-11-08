# FocusFlow

A private, offline-first planner and study organiser (PWA) for iPad and Android.
No accounts, no AI, no ads, no paid services. All data stays on your device (IndexedDB).

## Put it online for free (needed once, so you can "Add to Home Screen")

A PWA must be served over https. Two free options that work from an iPad:

**GitHub Pages**
1. Create a free GitHub account, then a new **public** repository (e.g. `focusflow`).
2. In the repo, tap **Add file ▸ Upload files** and upload the *contents* of this folder (unzip first; keep the `css`, `js` and `icons` folders).
3. **Settings ▸ Pages ▸ Deploy from a branch ▸ main / (root)** and save.
4. After a minute your app is at `https://<your-username>.github.io/focusflow/`.

**Cloudflare Pages** — Workers & Pages ▸ Create ▸ Pages ▸ **Upload assets**, then upload this folder.

## Install
- **iPad (Safari):** Share ▸ **Add to Home Screen**.
- **Android (Chrome):** menu ▸ **Install app**.

## Back up your data
Your data lives only on the device. Use **Settings ▸ Export backup** regularly and keep the file in Files/Drive.
**Restore backup** loads it back, including onto a different device.

## Updating the app
When you change any file, edit `CACHE = 'focusflow-v5'` in `sw.js` to a new name (e.g. `focusflow-v6`) so devices pick up the update.

## Known limits (zero-cost design)
- Reminders alert you while the app is open. Closed-app notifications are not guaranteed, especially on iPad.
- Sync across devices uses a free GitHub account (see below). Without one, use Export backup + Merge a backup file.
- A PIN is a lock screen, not encryption.
- Calendar: manual .ics export; live Google Calendar sync is not included.

## Fonts
Fredoka, Nunito and Patrick Hand are bundled in `fonts/` (SIL Open Font License) so they work offline. Switch back to the device font in **Settings ▸ Appearance ▸ Font style**.

## Troubleshooting: "redirection error" / "page moved" after installing
Fixed in this version (the app now opens at `./` and never replays a redirected page).
After uploading the new files:
1. Open the site in Safari/Chrome once (not from the icon) and wait a few seconds — it updates itself.
2. Open it from the Home Screen icon. It should load.
3. Still stuck? Visit your address with `?reset` on the end, e.g. `https://<you>.github.io/focusflow/?reset`.
   This clears only the offline copy — **your tasks, moods and notes are kept**.
4. Last resort: delete the Home Screen icon and add it again from the browser
   (iPad: open the address ending in `/`, then Share ▸ Add to Home Screen).

## Sync across devices (free, encrypted)
**Settings ▸ Sync across devices ▸ Set up sync.** You need a free GitHub account.
1. Create a token at https://github.com/settings/tokens/new?scopes=gist (only the **gist** box ticked, long/no expiration).
2. Paste the token and choose a **sync passphrase** — do the same on every device with the same token and passphrase.
3. That's it: the app syncs on open, a few seconds after each change, when you come back to it, and every 5 minutes.

How it works: everything is encrypted on your device (AES-256) with your passphrase, then stored as a private,
secret Gist in your GitHub account. GitHub can't read it. For each item, the most recent edit wins; deletions sync too.
The token and passphrase are stored only on each device. If you forget the passphrase, the cloud copy can't be opened,
but the data on your devices is unaffected — just set up sync again with a new passphrase.

No GitHub? **Export backup** on one device, then **Merge a backup file** on the other — it keeps the newest version of
everything instead of replacing.
