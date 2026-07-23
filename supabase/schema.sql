-- ATG Trucking LLC — Driver Production & Payroll
-- Run this whole file once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: guarded with IF NOT EXISTS / OR REPLACE where possible.

-- ============================================================
-- 1. PROFILES — one row per person (driver or admin), 1:1 with auth.users
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'driver' check (role in ('admin', 'driver')),
  full_name text not null,
  phone text,
  email text,
  truck_number text,
  hourly_pay numeric(8, 2) check (hourly_pay is null or hourly_pay >= 0),
  cdl_number text,
  license_expiration date,
  medical_card_expiration date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Driver and admin profiles, one row per auth.users id.';
comment on column public.profiles.hourly_pay is 'Admin-only field. Used to compute payroll cost on the dashboard.';

-- ============================================================
-- 2. PRODUCTION SHEETS — one row per driver per shift
-- ============================================================
create table if not exists public.production_sheets (
  id uuid primary key default gen_random_uuid(),
  -- restrict, not cascade: a driver's account can never be deleted out from
  -- under their payroll/production history. Use profiles.active = false to
  -- deactivate a driver instead — their historical sheets stay intact.
  driver_id uuid not null references public.profiles (id) on delete restrict,
  date date not null,
  truck_number text,
  start_time time,
  end_time time,
  hours numeric(5, 2) check (hours is null or hours >= 0),
  fuel_gallons numeric(6, 1) check (fuel_gallons is null or fuel_gallons >= 0),
  start_miles integer check (start_miles is null or start_miles >= 0),
  end_miles integer check (end_miles is null or end_miles >= 0),
  total_miles integer generated always as (
    case when end_miles is not null and start_miles is not null and end_miles >= start_miles
      then end_miles - start_miles
      else null
    end
  ) stored,
  mpg numeric(6, 2) generated always as (
    case when end_miles is not null and start_miles is not null and end_miles >= start_miles
      and fuel_gallons is not null and fuel_gallons > 0
      then round(((end_miles - start_miles)::numeric / fuel_gallons), 2)
      else null
    end
  ) stored,
  labor_cost numeric(10, 2),
  remarks text,
  submitted_at timestamptz not null default now(),
  -- Soft delete: "deleting" a sheet from the dashboard sets this instead of
  -- removing the row, so historical data and payroll records are never
  -- actually erased through normal use of the app. Admins can restore from
  -- the Trash view. A true, permanent delete still requires direct database
  -- access (the sheets_delete RLS policy below).
  deleted_at timestamptz,
  constraint miles_order check (start_miles is null or end_miles is null or end_miles >= start_miles)
);

comment on column public.production_sheets.labor_cost is 'Snapshot of hours * driver hourly_pay at submission time, kept via trigger so later pay-rate changes do not rewrite payroll history.';
comment on column public.production_sheets.deleted_at is 'Soft delete marker. NULL = active/visible. Set (not row-deleted) when an admin removes a sheet from the dashboard, so it can be restored from Trash.';

create index if not exists production_sheets_driver_date_idx on public.production_sheets (driver_id, date desc);
create index if not exists production_sheets_deleted_idx on public.production_sheets (deleted_at);

-- ============================================================
-- 3. LOADS — one or more rows per production sheet
-- ============================================================
create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.production_sheets (id) on delete cascade,
  job_site text,
  dumping text,
  type text,
  company text,
  job_site_arrival_time time,
  job_site_departure_time time,
  dumping_arrival_time time,
  dumping_departure_time time,
  note text
);

-- Safe to re-run on a database that already has this table from before
-- these columns existed. The rename only fires if the old names are still
-- there (a fresh install's create table above already used the new names).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'loads' and column_name = 'arrival_time'
  ) then
    alter table public.loads rename column arrival_time to job_site_arrival_time;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'loads' and column_name = 'departure_time'
  ) then
    alter table public.loads rename column departure_time to job_site_departure_time;
  end if;
end $$;
alter table public.loads add column if not exists job_site_arrival_time time;
alter table public.loads add column if not exists job_site_departure_time time;
alter table public.loads add column if not exists dumping_arrival_time time;
alter table public.loads add column if not exists dumping_departure_time time;
alter table public.loads add column if not exists note text;

create index if not exists loads_sheet_idx on public.loads (sheet_id);

-- ============================================================
-- 4. HELPER: is_admin() — SECURITY DEFINER so it can read profiles
--    without recursively triggering the RLS policy on profiles itself.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- 5. TRIGGER: auto-create a profile row when a new auth user signs up
--    (used by the admin "add driver" flow, which sets user metadata).
-- ============================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, truck_number, hourly_pay, cdl_number, license_expiration, medical_card_expiration, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'driver'),
    new.raw_user_meta_data ->> 'truck_number',
    nullif(new.raw_user_meta_data ->> 'hourly_pay', '')::numeric,
    new.raw_user_meta_data ->> 'cdl_number',
    nullif(new.raw_user_meta_data ->> 'license_expiration', '')::date,
    nullif(new.raw_user_meta_data ->> 'medical_card_expiration', '')::date,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================
-- 6. TRIGGER: only an admin may change role / pay / compliance / truck fields
--    on a profile. Defense in depth — enforced in the database, not just the UI.
-- ============================================================
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role
      or new.hourly_pay is distinct from old.hourly_pay
      or new.truck_number is distinct from old.truck_number
      or new.cdl_number is distinct from old.cdl_number
      or new.license_expiration is distinct from old.license_expiration
      or new.medical_card_expiration is distinct from old.medical_card_expiration
      or new.active is distinct from old.active
    then
      raise exception 'Only an admin can update pay, compliance, truck, or role fields.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields_trigger on public.profiles;
create trigger protect_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ============================================================
-- 7. TRIGGER: snapshot labor_cost = hours * driver's current hourly_pay
--    at the moment a sheet is inserted or its hours are edited.
-- ============================================================
create or replace function public.set_labor_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rate numeric(8, 2);
begin
  select hourly_pay into rate from public.profiles where id = new.driver_id;
  if new.hours is not null and rate is not null then
    new.labor_cost := round(new.hours * rate, 2);
  else
    new.labor_cost := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_labor_cost_trigger on public.production_sheets;
create trigger set_labor_cost_trigger
  before insert or update of hours, driver_id on public.production_sheets
  for each row execute function public.set_labor_cost();

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.production_sheets enable row level security;
alter table public.loads enable row level security;

-- profiles: admins see/edit everyone; drivers see/edit only themselves
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (public.is_admin() or id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (public.is_admin() or id = auth.uid());

-- production_sheets: admins see/manage everyone's; drivers see/insert only their own
drop policy if exists sheets_select on public.production_sheets;
create policy sheets_select on public.production_sheets
  for select using (public.is_admin() or driver_id = auth.uid());

drop policy if exists sheets_insert on public.production_sheets;
create policy sheets_insert on public.production_sheets
  for insert with check (public.is_admin() or driver_id = auth.uid());

drop policy if exists sheets_update on public.production_sheets;
create policy sheets_update on public.production_sheets
  for update using (public.is_admin());

drop policy if exists sheets_delete on public.production_sheets;
create policy sheets_delete on public.production_sheets
  for delete using (public.is_admin());

-- loads: follow the parent sheet's ownership
drop policy if exists loads_select on public.loads;
create policy loads_select on public.loads
  for select using (
    public.is_admin() or exists (
      select 1 from public.production_sheets s
      where s.id = loads.sheet_id and s.driver_id = auth.uid()
    )
  );

drop policy if exists loads_insert on public.loads;
create policy loads_insert on public.loads
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.production_sheets s
      where s.id = loads.sheet_id and s.driver_id = auth.uid()
    )
  );

drop policy if exists loads_update on public.loads;
create policy loads_update on public.loads
  for update using (public.is_admin());

drop policy if exists loads_delete on public.loads;
create policy loads_delete on public.loads
  for delete using (public.is_admin());

-- ============================================================
-- 9. BOOTSTRAP THE FIRST ADMIN
-- ============================================================
-- 1. Create your own user once, e.g. via Supabase Dashboard -> Authentication
--    -> Users -> Add user (check "Auto Confirm User"). This creates a
--    'driver' profile automatically via the trigger above.
-- 2. Then run this, swapping in your email, to promote yourself. The SQL
--    Editor runs outside any logged-in session, so protect_profile_fields()
--    can't see you as an admin yet — disable it for this one statement only:
--
--   alter table public.profiles disable trigger protect_profile_fields_trigger;
--   update public.profiles set role = 'admin' where email = 'you@yourcompany.com';
--   alter table public.profiles enable trigger protect_profile_fields_trigger;
