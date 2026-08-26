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
  -- Drivers no longer have accounts — sheets are entered entirely by an
  -- admin, who types (or picks from a suggestion list) whoever drove.
  driver_name text not null,
  hourly_pay numeric(8, 2) check (hourly_pay is null or hourly_pay >= 0),
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

comment on column public.production_sheets.labor_cost is 'Snapshot of hours * hourly_pay at submission time, kept via trigger so later edits to hourly_pay elsewhere do not rewrite payroll history.';
comment on column public.production_sheets.deleted_at is 'Soft delete marker. NULL = active/visible. Set (not row-deleted) when an admin removes a sheet from the dashboard, so it can be restored from Trash.';

-- Migration: driver accounts were retired — sheets used to link to a
-- login-capable profiles row (driver_id) and looked up its hourly_pay to
-- compute payroll. Now an admin just types the driver's name and rate
-- directly on the sheet, no account required. Safe to re-run: only acts if
-- the old driver_id column is still there.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'production_sheets' and column_name = 'driver_id'
  ) then
    -- These policies reference driver_id and would block dropping the
    -- column; the RLS section below recreates all of them without it.
    drop policy if exists sheets_select on public.production_sheets;
    drop policy if exists sheets_insert on public.production_sheets;
    drop policy if exists loads_select on public.loads;
    drop policy if exists loads_insert on public.loads;

    drop trigger if exists set_labor_cost_trigger on public.production_sheets;
    drop index if exists production_sheets_driver_date_idx;

    alter table public.production_sheets add column if not exists driver_name text;
    alter table public.production_sheets add column if not exists hourly_pay numeric(8, 2) check (hourly_pay is null or hourly_pay >= 0);

    update public.production_sheets s
    set driver_name = coalesce(p.full_name, 'Unknown'),
        hourly_pay = p.hourly_pay
    from public.profiles p
    where s.driver_id = p.id and s.driver_name is null;

    update public.production_sheets set driver_name = 'Unknown' where driver_name is null;

    alter table public.production_sheets alter column driver_name set not null;
    alter table public.production_sheets drop column driver_id;
  end if;
end $$;

create index if not exists production_sheets_driver_date_idx on public.production_sheets (driver_name, date desc);
create index if not exists production_sheets_deleted_idx on public.production_sheets (deleted_at);

-- ============================================================
-- 3. DRIVERS ROSTER — contact & compliance info only, no login.
--    Independent of production_sheets.driver_name (free text) so a
--    typo'd or one-off name on a sheet never blocks saving it.
-- ============================================================
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  phone text,
  hourly_pay numeric(8, 2) check (hourly_pay is null or hourly_pay >= 0),
  cdl_number text,
  license_expiration date,
  medical_card_expiration date,
  created_at timestamptz not null default now()
);

comment on column public.drivers.hourly_pay is 'Default rate, used to prefill a new sheet for this driver. Each sheet still stores its own hourly_pay so past payroll never changes if this is edited.';

insert into public.drivers (full_name) values
  ('Luis Villanueva'),
  ('Edgar Humberto Lugo Almodovar'),
  ('Ismael Angel Otero Mendoza'),
  ('Alexis JR Gonzales'),
  ('Roberto Luis Ortiz'),
  ('Juan Angel De Jesus Peralta Garcia'),
  ('Ismael Otero Nieves'),
  ('Abdiel Quinones Rivera'),
  ('Christopher Tyler Krings'),
  ('Gabriel Mojica'),
  ('Elias Centeno'),
  ('William A McGoldrick'),
  ('Mello Carmelo Ocasio'),
  ('Jhonatan Diaz'),
  ('Orlando Martinez Acevedo'),
  ('John O Cirino'),
  ('Joelvis Cruz Chico'),
  ('William A Lopez-Valdes')
on conflict (full_name) do nothing;

-- ============================================================
-- 4. LOADS — one or more rows per production sheet
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
-- 5. HELPER: is_admin() — SECURITY DEFINER so it can read profiles
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
-- 6. TRIGGER: auto-create a profile row when a new auth user signs up
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
-- 7. TRIGGER: only an admin may change role / pay / compliance / truck fields
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
-- 8. TRIGGER: snapshot labor_cost = hours * hourly_pay at the moment a
--    sheet is inserted or its hours/rate are edited.
-- ============================================================
create or replace function public.set_labor_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hours is not null and new.hourly_pay is not null then
    new.labor_cost := round(new.hours * new.hourly_pay, 2);
  else
    new.labor_cost := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_labor_cost_trigger on public.production_sheets;
create trigger set_labor_cost_trigger
  before insert or update of hours, hourly_pay on public.production_sheets
  for each row execute function public.set_labor_cost();

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.production_sheets enable row level security;
alter table public.loads enable row level security;
alter table public.drivers enable row level security;

-- profiles: admins see/edit everyone; drivers see/edit only themselves
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (public.is_admin() or id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (public.is_admin() or id = auth.uid());

-- production_sheets & loads: admin-only. Drivers no longer have accounts —
-- every sheet is entered and managed by an admin.
drop policy if exists sheets_select on public.production_sheets;
create policy sheets_select on public.production_sheets
  for select using (public.is_admin());

drop policy if exists sheets_insert on public.production_sheets;
create policy sheets_insert on public.production_sheets
  for insert with check (public.is_admin());

drop policy if exists sheets_update on public.production_sheets;
create policy sheets_update on public.production_sheets
  for update using (public.is_admin());

drop policy if exists sheets_delete on public.production_sheets;
create policy sheets_delete on public.production_sheets
  for delete using (public.is_admin());

drop policy if exists loads_select on public.loads;
create policy loads_select on public.loads
  for select using (public.is_admin());

drop policy if exists loads_insert on public.loads;
create policy loads_insert on public.loads
  for insert with check (public.is_admin());

drop policy if exists loads_update on public.loads;
create policy loads_update on public.loads
  for update using (public.is_admin());

drop policy if exists loads_delete on public.loads;
create policy loads_delete on public.loads
  for delete using (public.is_admin());

-- drivers: admin-only. No login is tied to these rows — it's a roster.
drop policy if exists drivers_select on public.drivers;
create policy drivers_select on public.drivers
  for select using (public.is_admin());

drop policy if exists drivers_insert on public.drivers;
create policy drivers_insert on public.drivers
  for insert with check (public.is_admin());

drop policy if exists drivers_update on public.drivers;
create policy drivers_update on public.drivers
  for update using (public.is_admin());

drop policy if exists drivers_delete on public.drivers;
create policy drivers_delete on public.drivers
  for delete using (public.is_admin());

-- ============================================================
-- 10. INVOICE TICKETS — one row per client billing ticket, independent of
--    production_sheets (which tracks driver payroll/production, not
--    per-client billing). Mirrors the paper "daily truck ticket" format.
-- ============================================================
create table if not exists public.invoice_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text,
  date date not null,
  client text not null,
  location_project text,
  truck_number text,
  company_name text not null default 'ATG Trucking LLC',
  time_in time,
  time_out time,
  travel_time_hours numeric(5, 2) check (travel_time_hours is null or travel_time_hours >= 0),
  total_hours numeric(5, 2) check (total_hours is null or total_hours >= 0),
  loads integer check (loads is null or loads >= 0),
  created_at timestamptz not null default now()
);

comment on column public.invoice_tickets.total_hours is 'Computed client-side from time_in/time_out minus travel_time_hours at save time, same convention as production_sheets.hours — not a generated column, so a ticket keyed in from a paper original can still be corrected by hand later.';

create index if not exists invoice_tickets_date_idx on public.invoice_tickets (date desc);

alter table public.invoice_tickets enable row level security;

drop policy if exists invoice_tickets_select on public.invoice_tickets;
create policy invoice_tickets_select on public.invoice_tickets
  for select using (public.is_admin());

drop policy if exists invoice_tickets_insert on public.invoice_tickets;
create policy invoice_tickets_insert on public.invoice_tickets
  for insert with check (public.is_admin());

drop policy if exists invoice_tickets_update on public.invoice_tickets;
create policy invoice_tickets_update on public.invoice_tickets
  for update using (public.is_admin());

drop policy if exists invoice_tickets_delete on public.invoice_tickets;
create policy invoice_tickets_delete on public.invoice_tickets
  for delete using (public.is_admin());

-- ============================================================
-- 11. CLIENTS — billing/mailing info for who ATG invoices (the "Bill To"
--    box on a generated invoice). Independent of invoice_tickets.client
--    (free text) so a typo'd or one-off name on a ticket never blocks
--    saving it — same relationship as drivers roster <-> driver_name.
-- ============================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  company text,
  address_line1 text,
  city_state_zip text,
  phone text,
  fax text,
  email text,
  default_rate numeric(8, 2) check (default_rate is null or default_rate >= 0),
  created_at timestamptz not null default now()
);

comment on column public.clients.default_rate is 'Prefills a new ticket''s Rate field for this client, same convention as drivers.hourly_pay.';
comment on column public.clients.company is 'Business/company name, separate from name (which may be a contact person) — shown under the contact on the invoice Bill To block.';

-- Retrofit for databases created before this column existed.
alter table public.clients add column if not exists company text;

alter table public.clients enable row level security;

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select using (public.is_admin());
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert with check (public.is_admin());
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update using (public.is_admin());
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete using (public.is_admin());

-- ============================================================
-- 12. INVOICES — a generated billing document that groups one or more
--    invoice_tickets for a single client into one PDF with a total.
-- ============================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null,
  date date not null,
  client_id uuid not null references public.clients (id),
  customer text,
  for_description text,
  terms text not null default 'Net 30 days',
  total numeric(10, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'pending', 'paid')),
  check_number text,
  check_received_date date,
  created_at timestamptz not null default now()
);

create index if not exists invoices_client_idx on public.invoices (client_id, date desc);

-- Retrofit for databases created before these columns existed.
alter table public.invoices add column if not exists status text not null default 'draft' check (status in ('draft', 'pending', 'paid'));
alter table public.invoices add column if not exists check_number text;
alter table public.invoices add column if not exists check_received_date date;

-- Retrofit: widen the status constraint to allow 'draft' for databases that
-- already had this column under the old ('pending','paid')-only constraint —
-- draft invoices are saved before being finalized and sent to the client.
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check check (status in ('draft', 'pending', 'paid'));

alter table public.invoices enable row level security;

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select using (public.is_admin());
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert with check (public.is_admin());
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update using (public.is_admin());
drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices for delete using (public.is_admin());

-- invoice_tickets: per-ticket $/hr rate (for the invoice line's Amount),
-- and which generated invoice (if any) this ticket has been billed on.
alter table public.invoice_tickets add column if not exists rate numeric(8, 2) check (rate is null or rate >= 0);
alter table public.invoice_tickets add column if not exists invoice_id uuid references public.invoices (id) on delete set null;
create index if not exists invoice_tickets_invoice_idx on public.invoice_tickets (invoice_id);

-- invoice_tickets: tow reimbursement — a per-tow flat rate times how many
-- tows happened on this ticket, kept separate from the hourly Amount and
-- broken out as its own column on the invoice.
alter table public.invoice_tickets add column if not exists tow_rate numeric(8, 2) check (tow_rate is null or tow_rate >= 0);
alter table public.invoice_tickets add column if not exists tow_count integer check (tow_count is null or tow_count >= 0);

-- invoice_tickets: optional storage path to a photo/PDF scan of the
-- original paper ticket this row was keyed in from.
alter table public.invoice_tickets add column if not exists scan_path text;

-- ============================================================
-- 13. TICKET SCANS (STORAGE) — a private bucket holding photo/PDF scans
--    of the original paper ticket each invoice_tickets row was keyed in
--    from. Objects are keyed by ticket id, so cleanup on ticket delete is
--    a plain storage remove() from the app rather than a DB cascade.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-scans', 'ticket-scans', false, 20971520)
on conflict (id) do update set file_size_limit = 20971520;

drop policy if exists ticket_scans_select on storage.objects;
create policy ticket_scans_select on storage.objects
  for select using (bucket_id = 'ticket-scans' and public.is_admin());

drop policy if exists ticket_scans_insert on storage.objects;
create policy ticket_scans_insert on storage.objects
  for insert with check (bucket_id = 'ticket-scans' and public.is_admin());

drop policy if exists ticket_scans_update on storage.objects;
create policy ticket_scans_update on storage.objects
  for update using (bucket_id = 'ticket-scans' and public.is_admin());

drop policy if exists ticket_scans_delete on storage.objects;
create policy ticket_scans_delete on storage.objects
  for delete using (bucket_id = 'ticket-scans' and public.is_admin());

-- ============================================================
-- 14. SHEET PHOTOS (STORAGE) — a private bucket holding photos of physical
--    production sheets uploaded for AI data extraction. Purely transient:
--    the app deletes each object right after extraction, whether it
--    succeeds or fails, since the photo's only job is OCR input.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('sheet-photos', 'sheet-photos', false, 20971520)
on conflict (id) do update set file_size_limit = 20971520;

drop policy if exists sheet_photos_select on storage.objects;
create policy sheet_photos_select on storage.objects
  for select using (bucket_id = 'sheet-photos' and public.is_admin());

drop policy if exists sheet_photos_insert on storage.objects;
create policy sheet_photos_insert on storage.objects
  for insert with check (bucket_id = 'sheet-photos' and public.is_admin());

drop policy if exists sheet_photos_update on storage.objects;
create policy sheet_photos_update on storage.objects
  for update using (bucket_id = 'sheet-photos' and public.is_admin());

drop policy if exists sheet_photos_delete on storage.objects;
create policy sheet_photos_delete on storage.objects
  for delete using (bucket_id = 'sheet-photos' and public.is_admin());

-- ============================================================
-- 15. BOOTSTRAP THE FIRST ADMIN
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
