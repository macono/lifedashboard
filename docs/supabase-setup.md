# Connecting Supabase

You do this once. It takes about 15 minutes. Afterward, the app asks you to sign in and saves tasks and journal entries
to your own Supabase database, so they're the same on every device.

You can stop partway through without breaking anything. Until step 5 is done, the app keeps running in browser demo mode.

## 1. Create a project
1. Sign in at https://supabase.com and click **New project**.
2. Name it `life-dashboard`. Pick the region closest to you, for example *East US*.
3. Generate a database password and **save it in your password manager**. The app never needs it.
4. Wait about 2 minutes for the project to finish starting.

## 2. Create the tables and security rules
1. Open **SQL Editor** in the left menu, then click **New query**.
2. Open `supabase/migrations/20261107000000_tasks_and_journal.sql` from this project, copy **all** of it, and paste it into the editor.
3. Click **Run**. The result should say *Success. No rows returned*.
4. Check the result: open **Table Editor**. You should see `tasks`, `task_notes`, and `journal_entries`, and none of them should show an *RLS disabled* warning.

## 3. Turn off public sign-up
This is a personal app, so nobody else should be able to create an account.
1. Go to **Authentication → Sign In / Providers**. On older dashboards, this is **Authentication → Providers / Settings**.
2. Make sure **Email** is enabled.
3. Turn **off** **Allow new users to sign up**, then click **Save**.

## 4. Create your login
1. Go to **Authentication → Users → Add user → Create new user**.
2. Enter your email and a strong password, and save it in your password manager.
3. Check **Auto Confirm User**. You don't need a confirmation email.
4. Click **Create user**.

## 5. Connect the app
1. In Supabase, go to **Project Settings → API Keys**. Copy:
   - the **Project URL**, which looks like `https://abcdefghijkl.supabase.co` (it's also under **Data API**)
   - the **Publishable key**, which starts with `sb_publishable_`. The legacy **anon** key also works.

   **Do not copy the secret or service_role key.** This app never needs it.
2. In the project folder on your Mac:
   ```bash
   cp .env.example .env.local
   ```
3. Open `.env.local` in Cursor and fill in the two values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijkl.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   `.env.local` is ignored by git, so it won't be committed.
4. Restart the app. Press Ctrl+C, then run `npm run dev`. If you use the phone setup, run `npm run build && npm start`
   again: these values are baked in at build time.

## 6. Sign in and bring over your demo data
1. Open the app. You should see a **Sign in** screen. Sign in with the login from step 4.
2. The badge now says **Saved to your account**.
3. To copy tasks and journal entries you made in demo mode, click the badge, then **Import from this browser…**.
   You'll see a preview first. Example tasks are left out unless you tick the box. Journal dates that already exist
   in your account are skipped, and nothing in the browser is deleted.

## Good to know
- **Free plan:** Supabase pauses free projects after about a week with no activity. Restore it from the dashboard and your data is still there.
- **Backups:** daily backups are included on paid plans. Use **Download a copy (JSON)** in the app for your own backup.
- **Security:** the publishable key is meant to be public. Your data is protected by your login plus the database rules
  in the migration, which allow only the signed-in owner to read or change a row. These rules are tested by `scripts/test-db.sh`.
- **To go back to demo mode:** rename `.env.local` (for example to `.env.local.off`) and restart the app.
