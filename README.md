# Orlander's Life Dashboard

A personal command center. **Increment 1** includes a navigation shell and three working pages:
**Overview**, **Tasks**, and **Daily Journal**, plus a global **Capture** button.

All data is **demo data saved in your browser**. You don't need Supabase or any other account to run it.

## Setup

You need Node.js 20.9 or newer (Node 22 LTS recommended). To check, run `node -v`.

```bash
cd life-dashboard
npm install
npm run dev
```

Open http://localhost:3000.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the development server with hot reload |
| `npm run build` | Creates a production build |
| `npm start` | Serves the production build (run `build` first) |
| `npm run typecheck` | Runs the TypeScript type check |
| `npm run lint` | Runs ESLint |
| `npm test` | Runs the unit tests (Vitest) |
| `npm run check` | Runs typecheck, lint, and tests together |

## How data is stored (read this)

- Tasks and journal entries are saved in this browser's **localStorage**, under the key `life-dashboard:v1`.
- Data stays on **one device and one browser**. Chrome and Safari don't share it, and neither does your phone.
- localStorage has **no login, no encryption, no backup, and no sync**. Clearing site data or browsing history erases it.
- On first run, the app adds a few fictional tasks labeled **Example**. This happens only once, so a deleted example won't come back.
- The **Demo — saved in this browser** button lets you **download a JSON copy** or **reset demo data**. A reset asks you to confirm. Before it replaces anything, it copies the old data to a `life-dashboard:backup:<timestamp>` key in the same browser.
- If the stored data is malformed, the app **stops and tells you** instead of overwriting it. You can download the raw data before you reset.
- The app doesn't read or change your existing ChatGPT or Google Drive records.

### Dates

Due dates and journal dates are stored as local calendar dates (`YYYY-MM-DD`) and are never converted through UTC. A journal entry written at 11 PM stays on that day.
Timestamps such as `createdAt` and note times are stored as ISO UTC strings and displayed in your local time.

## Project structure

```
src/
  app/                      Routes (thin wrappers)
    layout.tsx              Providers + navigation shell
    page.tsx                Overview  (/)
    tasks/page.tsx          Tasks     (/tasks?view=…&task=…)
    journal/page.tsx        Journal   (/journal?date=YYYY-MM-DD)
  components/
    shell/                  App shell, data gate (loading/errors), storage dialog
    overview/ tasks/ journal/ capture/   Feature UI
    ui/                     shadcn/ui components (owned source files)
  lib/
    dates.ts                Local calendar-date helpers
    data/
      types.ts              Task, JournalEntry, the 8 journal sections
      tasks.ts journal.ts capture.ts   Pure logic (no React, no storage)
      validate.ts           Checks stored data and never repairs it by deleting
      local-repository.ts   The ONLY code that touches localStorage
      store.ts              LifeStore: state + async actions
      provider.tsx          React hooks (useLifeState, useLifeStore)
tests/                      Vitest unit tests
```

**Data boundary:** UI → `useLifeStore()` / `useLifeState()` → `LifeStore` → repository.
Store actions are already `async` and return `{ ok, value | error }`. A Supabase repository can replace
`local-repository.ts` without changing page components.

## Toward Supabase (next increments, not built yet)

- Supabase Auth; every table has a `user_id` with Row Level Security (`user_id = auth.uid()`).
- SQL migrations live in `supabase/migrations/` in source control.
- Only the public anon key goes in the browser. The service-role key and other secrets stay out of the frontend and out of git (`.env*` is git-ignored).
- Migration path for demo data: use **Download a copy (JSON)** → sign in → one-time import screen that inserts rows under your user, with a preview and confirmation first.

## Notes

- This project uses Next.js 16 with `cacheComponents`. When you navigate away from a page, Next.js keeps it mounted but hidden, so its state is preserved.
- To add a shadcn component, run `npx shadcn@latest add <name>`. `components.json` is already configured.
