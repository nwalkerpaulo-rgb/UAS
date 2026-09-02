-- ============================================================
-- MIGRAÇÃO: planeamento de missão
-- ============================================================

create type mission_planning_status as enum ('planeada', 'pronta', 'em_curso', 'concluida', 'cancelada');
create type mission_risk as enum ('baixo', 'medio', 'alto');

alter table missions
  add column if not exists planning_status mission_planning_status not null default 'concluida',
  add column if not exists scheduled_at timestamptz,
  add column if not exists objective text,
  add column if not exists risk_level mission_risk,
  add column if not exists observer_id uuid references profiles(id) on delete set null,
  add column if not exists payload text,
  add column if not exists expected_duration_min integer,
  add column if not exists checklist_pilot_ok boolean not null default false,
  add column if not exists checklist_drone_ok boolean not null default false,
  add column if not exists checklist_battery_ok boolean not null default false,
  add column if not exists checklist_maintenance_ok boolean not null default false,
  add column if not exists checklist_area_ok boolean not null default false,
  add column if not exists checklist_docs_ok boolean not null default false;

-- missões já existentes (importadas ou registadas em sessão) ficam como
-- 'concluida' no planeamento, já que não passaram por este fluxo
comment on column missions.planning_status is 'Estado do fluxo de planeamento — distinto de "status" (resultado da missão)';
