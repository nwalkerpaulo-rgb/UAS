-- ============================================================
-- MIGRAÇÃO: definições da organização (singleton)
-- (segura de correr mais que uma vez)
-- ============================================================

create table if not exists app_settings (
  id text primary key default 'default' check (id = 'default'),
  cert_expiry_warning_days integer not null default 30,
  maintenance_warning_days integer not null default 7,
  wind_gust_limit_ms numeric not null default 10,
  battery_max_cycles integer not null default 300,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

insert into app_settings (id) values ('default') on conflict (id) do nothing;

alter table app_settings enable row level security;

drop policy if exists "app_settings_select" on app_settings;
create policy "app_settings_select" on app_settings for select using (auth.role() = 'authenticated');

drop policy if exists "app_settings_update" on app_settings;
create policy "app_settings_update" on app_settings for update
  using (current_user_role() in ('admin','gestor'))
  with check (current_user_role() in ('admin','gestor'));
