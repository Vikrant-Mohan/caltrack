# Installing Caltrack as a PWA

Caltrack is a **Progressive Web App** (PWA): once installed it launches in its
own window, has an app icon on your home screen / desktop, and keeps working
(mostly) offline thanks to its service worker. Your data lives in your
browser's local storage, so it stays on the device you install it on.

## Requirements

- A modern browser. Chrome or Edge (desktop + Android) give the best install
  experience; iOS Safari can add it to the home screen.
- The app must be served over **HTTPS** — or reachable as
  `http://localhost` while you test locally. Browsers refuse to install PWAs
  from plain `http://` addresses on other hosts.

> The service worker only runs in **production builds**. `npm run dev` skips
> registration so hot reloading stays snappy — use a production build when you
> want to test the PWA features.

---

## Install from a deployed URL

1. Open the deployed Caltrack URL in your browser and complete onboarding.
2. Install using your platform's flow below.

## Install from localhost (development / self-hosting)

```bash
npm install
npm run build
npm start          # serves the production build on http://localhost:3000
```

Open http://localhost:3000 and use the same platform flows below.

---

## Desktop — Chrome / Edge (Windows, macOS, Linux)

1. Open Caltrack.
2. Click the **install icon** in the address bar (a monitor with a down
   arrow, usually on the right). If it doesn't appear, open the
   **⋮ (three-dot) menu → "Install Caltrack…"** or **"Cast, save and share →
   Install page as app"**.
3. Confirm the dialog — Caltrack now opens in its own window with its own
   taskbar / dock icon.

## Android — Chrome

1. Open Caltrack in Chrome.
2. Tap the **⋮ menu → "Add to Home screen"** or **"Install app"** (you may
   also see an "Install Caltrack" banner or a bottom-sheet prompt).
3. Tap **Install** — the app appears on your home screen and launches
   full-screen without browser chrome.

## iPhone / iPad — Safari

iOS doesn't show an install prompt; use Safari's home-screen shortcut, which
installs the PWA the same way:

1. Open Caltrack in Safari.
2. Tap the **Share** button (square with an up arrow).
3. Tap **"Add to Home Screen"**.
4. Name it (e.g. "Caltrack") and tap **Add** — it appears as an app icon and
   launches standalone with the Caltrack icon.

## Linux / other browsers

Firefox supports PWAs via its own "Install" menu item; other Chromium-based
browsers (Brave, Opera, Vivaldi) follow the desktop Chrome flow above.

---

## Updating & troubleshooting

- **Updates:** when you open the installed app, the service worker checks for
  a new version and updates in the background; a refresh applies it.
- **Not showing the install option?** Make sure you're on HTTPS or localhost,
  the page has loaded fully, and try hard-refreshing (Ctrl/Cmd+Shift+R).
- **Reset the app:** to wipe local data and the service worker cache,
  uninstall the app from your browser/OS, then re-open the URL once and
  re-install.
- **Where is my data?** Everything (profile, food logs, weight check-ins) is
  stored in that browser's localStorage — uninstalling the PWA or using
  another browser/device starts fresh. Export or clear data from the browser's
  site settings if needed.

---

## Icons & branding

Generated icons live in `public/icons/` and the manifest in
`src/app/manifest.ts`. To regenerate the icons:

```bash
npm run icons
```
