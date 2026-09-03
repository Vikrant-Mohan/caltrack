# Caltrack 🔥

A free, mobile-first calorie tracker — a lightweight alternative to Lose It!.
Log meals by search or barcode scan, track macros against your goal, and check
in your weight each day to watch the trend against your lose/gain pace.

## Features

- **Onboarding & TDEE** — Mifflin-St Jeor calculator with activity multipliers,
  a Lose/Maintain/Gain goal (or a custom daily calorie budget), and an
  automatic 30/40/30 protein/carbs/fat split.
- **Dashboard diary** — day-by-day diary with prev/next day arrows, a calorie
  ring, macro bars, per-meal groups, and a weekly summary with mini rings and
  7-day average macros vs. your targets.
- **Food search** — searches **USDA FoodData Central** (generic foods like
  "bread, whole wheat") and **OpenFoodFacts** (branded products), deduped and
  merged. Products resolve to real household servings ("1 large slice (43 g)")
  and anything you log lands in Recents for one-tap re-logging.
- **Barcode scanner** — scans product barcodes via the camera and looks them up
  in OpenFoodFacts.
- **Weight check-ins** — one entry per day, editable/removable, with a trend
  chart and a dashed goal-pace line vs. your ±0.5 kg/week goal.

All data stays on your device (Zustand + localStorage) — no account, no
backend.

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui (Base UI) ·
Zustand · recharts · html5-qrcode · date-fns

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### USDA FoodData Central (optional, recommended)

Food search falls back to OpenFoodFacts only when the USDA key is missing.
Get a free key at https://fdc.nal.usda.gov/api-key-signup.html, then create a
`.env.local` from the template:

```bash
cp .env.local.example .env.local
# add your FDC_API_KEY
```

## Install as an app

Caltrack is a PWA — see [install.md](install.md) for how to install it on desktop, Android and iOS, plus localhost testing notes.

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint
- `npm run icons` — regenerate the PWA icons
- `npx tsc --noEmit` — typecheck
