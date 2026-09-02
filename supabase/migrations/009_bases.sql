-- ============================================================
-- MIGRAÇÃO: bases / pontos de lançamento
-- (segura de correr mais que uma vez)
-- ============================================================

create table if not exists bases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'base',  -- 'base' ou 'ponto_lancamento'
  lat double precision not null,
  lng double precision not null,
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table bases enable row level security;

drop policy if exists "bases_select" on bases;
create policy "bases_select" on bases for select using (auth.role() = 'authenticated');

drop policy if exists "bases_write" on bases;
create policy "bases_write" on bases for all
  using (current_user_role() in ('admin','gestor'))
  with check (current_user_role() in ('admin','gestor'));
