# ATG Trucking — Driver Production & Payroll

A real, hosted web app for daily driver production sheets, a fleet dashboard, and
per-driver payroll — with real authentication and per-driver logins (Supabase),
not a client-side PIN. Deploys to Vercel.

## What's in here

- **Drivers** sign in and submit a daily production sheet (loads, hours, fuel, mileage).
  They can see their own submission history and change their password.
- **Admins** sign in to a dashboard with fleet-wide KPIs, charts, a payroll table
  (hours × each driver's pay rate), and a driver directory with pay rate, truck
  assignment, and CDL/medical-card compliance tracking.
- Access is enforced by the database itself (Postgres Row Level Security), not
  just by the UI — a driver's session literally cannot read another driver's
  data or edit their own pay rate, even if they inspect network requests.
- **Nothing is ever silently erased.** "Deleting" a sheet from the dashboard
  moves it to **Trash**, where an admin can restore it — it's never actually
  removed from the database that way. A driver's account can't be deleted
  while they have any production history (the database rejects it); use
  "Active" / "Inactive" on their profile instead. Admins can also download a
  full JSON backup of every driver and sheet on demand from the dashboard.

## Keeping this data for the long haul

This app is only as durable as the Supabase project behind it:

- **Don't run this in production on Supabase's free tier.** Free projects
  pause after a period of inactivity, and a project left paused too long can
  eventually be deleted. Upgrade to a paid plan before you rely on this for
  real payroll records — Project Settings → Billing in the Supabase dashboard.
- **Turn on Point-in-Time Recovery** (Database → Backups) once you're on a
  paid plan, so you can recover to any moment, not just the last daily backup.
- **Use the "Export All Data" button** on the admin dashboard periodically for
  your own offline copy, independent of Supabase entirely.

## One-time setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a free project, and wait for
it to finish provisioning.

### 2. Run the database migration

In the Supabase dashboard: **SQL Editor → New query**, paste the entire contents
of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the
`profiles`, `production_sheets`, and `loads` tables, the payroll trigger, and all
Row Level Security policies.

### 3. Get your API keys

In the Supabase dashboard: **Project Settings → API**. You'll need three values:

- `Project URL`
- `anon` `public` key
- `service_role` `secret` key — **keep this one server-side only**

### 4. Set environment variables

Copy `.env.example` to `.env.local` and fill in the three values from step 3:

```bash
cp .env.example .env.local
```

### 5. Install dependencies and run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Create yourself as the first admin

1. On the running app, there's no public sign-up page by design (only admins
   create driver accounts). For the very first account, go to the Supabase
   dashboard: **Authentication → Users → Add user**, create your own account
   with your email and a password, and check "Auto Confirm User".
2. Back in **SQL Editor**, run all three lines together (the SQL Editor has no
   logged-in session, so the role-protection trigger has to be turned off for
   this one statement, then back on):
   ```sql
   alter table public.profiles disable trigger protect_profile_fields_trigger;
   update public.profiles set role = 'admin' where email = 'you@yourcompany.com';
   alter table public.profiles enable trigger protect_profile_fields_trigger;
   ```
3. Sign in at `/login` with that email and password — you'll land on the admin
   dashboard.
4. From **Drivers → Add Driver**, create logins for your actual drivers. Share
   each driver's temporary password with them directly; they can change it
   from their own Account page after signing in.

## Deploying to Vercel

1. Push this project to a GitHub repository.
2. On [vercel.com](https://vercel.com), import the repository.
3. Add the same three environment variables from `.env.local` in the Vercel
   project's **Settings → Environment Variables**.
4. Deploy. Vercel will give you a live URL — that's what your drivers and
   admins use going forward.

## Project structure

```
src/
  app/
    login/              Sign-in page
    page.tsx            Driver home (sheet form + own history)
    account/            Change password, view own profile
    admin/              Admin-only (role-gated in admin/layout.tsx)
      page.tsx          Dashboard: KPIs, charts, payroll, production log
      drivers/          Driver directory, add/edit driver
      trash/            Restore soft-deleted sheets
  components/
    SheetForm.tsx        Driver's production sheet form
    admin/AdminDashboard.tsx   Dashboard filtering, aggregation, and layout
    charts/               Reusable bar/trend chart components
  lib/
    supabase/            Browser, server, and admin (service-role) clients
    actions/              Server Actions (auth, sheets, drivers, admin)
    session.ts            requireProfile() / requireAdmin() route guards
  proxy.ts                Next.js 16's renamed middleware — refreshes the
                           auth session cookie and gates unauthenticated routes
supabase/schema.sql        Full database schema, RLS policies, and triggers
```

## Security model, briefly

- Every table has Row Level Security enabled. A driver's Postgres role can only
  `select`/`insert` rows where `driver_id` is their own `auth.uid()`.
- A database trigger blocks non-admins from changing `role`, `hourly_pay`,
  `truck_number`, or compliance fields on a profile — even their own — so this
  can't be bypassed by calling the API directly.
- `labor_cost` is snapshotted per sheet at submission time (hours × the
  driver's pay rate *at that moment*), so editing a driver's pay rate later
  doesn't rewrite payroll history.
- The `service_role` key (used only to create new driver logins) is read from
  a server-only environment variable and never sent to the browser.
