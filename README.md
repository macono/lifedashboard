# Orlander's Life Dashboard

A personal command center with a navigation shell, three working pages (**Overview**, **Tasks**, **Daily Journal**),
and a global **Capture** button.

The app runs in one of two modes:

- **Account mode (Supabase):** you sign in, and your data is stored in your own Supabase database and shared across your devices.
  To set it up, follow **[docs/supabase-setup.md](docs/supabase-setup.md)** (about 15 minutes, once).
- **Demo mode:** when no Supabase settings are present, data is saved only in this browser. No account is needed.

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
| `npm run test:db` | Tests the database migration and security rules on a throwaway local PostgreSQL (needs PostgreSQL 15+ installed; optional) |

## How data is stored in demo mode (read this)

- Tasks and journal entries are saved in this browser's **localStorage**, under the key `life-dashboard:v1`.
- Data stays on **one device and one browser**. Chrome and Safari don't share it, and neither does your phone.
- localStorage has **no login, no encryption, no backup, and no sync**. Clearing site data or browsing history erases it.
- On first run, the app adds a few fictional tasks labeled **Example**. This happens only once, so a deleted example won't come back.
- The **Demo — saved in this browser** button lets you **download a JSON copy** or **reset demo data**. A reset asks you to confirm. Before it replaces anything, it copies the old data to a `life-dashboard:backup:<timestamp>` key in the same browser.
- If the stored data is malformed, the app **stops and tells you** instead of overwriting it. You can download the raw data before you reset.
- The app doesn't read or change your existing ChatGPT or Google Drive records.

## How data is stored in account mode

- Tables: `tasks`, `task_notes`, `journal_entries`. The SQL lives in `supabase/migrations/`.
- Every row has a `user_id`. **Row Level Security** lets the signed-in owner read and change only their own rows, and
  signed-out visitors get nothing. `npm run test:db` verifies this, including attempts by one user to reach another's data.
- The browser uses only the **publishable (anon) key**. No secret or service-role key is used anywhere in the app.
  `.env.local` holds your settings and is ignored by git.
- Public sign-up should be turned off. You create your login in the Supabase dashboard (see the setup guide).
- Changes are saved to the database first and shown afterward. If a save fails, you see an error and the screen keeps the old state.
- Other devices pick up changes when you return to the app or refresh. If two devices edit the same journal date, the last save wins.
- **Import from this browser** (open the badge in the sidebar) copies demo-mode tasks and journal entries into your account.
  It shows a preview first, leaves example tasks out by default, skips journal dates that already exist, and deletes nothing.

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
      repository.ts         The storage interface (load + commit a change)
      local-repository.ts   Demo mode: the ONLY code that touches localStorage
      supabase-repository.ts  Account mode: database reads and writes
      supabase-mapping.ts   Database rows <-> app model
      store.ts              LifeStore: state, ordered async actions, import
      provider.tsx          Chooses demo or account storage; React hooks
    supabase/               Supabase settings and browser client
  components/auth/          Sign-in screen and session handling
supabase/
  migrations/               SQL for tables + Row Level Security (apply in order)
  tests/                    Security tests for the migration (run with npm run test:db)
docs/supabase-setup.md      Step-by-step Supabase setup
tests/                      Vitest unit tests
```

**Data boundary:** UI → `useLifeStore()` / `useLifeState()` → `LifeStore` → `Repository` (local or Supabase).
Page components don't know which storage is in use.

## Changing the database later

Add a new file in `supabase/migrations/` with a later timestamp. Never edit a migration that has already been applied.
Run `npm run test:db`, then apply it in the Supabase SQL Editor, or later with the Supabase CLI (`supabase db push`).

## Notes

- This project uses Next.js 16 with `cacheComponents`. When you navigate away from a page, Next.js keeps it mounted but hidden, so its state is preserved.
- To add a shadcn component, run `npx shadcn@latest add <name>`. `components.json` is already configured.
