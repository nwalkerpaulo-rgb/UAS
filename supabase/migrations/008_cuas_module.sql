-- ============================================================
-- MIGRAÇÃO: módulo C-UAS — deteções, e baterias/missões que
-- podem pertencer a um sistema contra-drone em vez de um drone
-- ============================================================

-- Missões: podem estar associadas a um sistema C-UAS em vez de um drone
alter table missions
  add column if not exists counter_drone_system_id uuid references counter_drone_systems(id) on delete set null;

-- Baterias: também podem pertencer a um sistema C-UAS
alter table batteries
  add column if not exists counter_drone_system_id uuid references counter_drone_systems(id) on delete set null;

-- ============================================================
-- DETEÇÕES
-- ============================================================
-- Registo manual de uma deteção feita por um sistema C-UAS.
-- Não é um sistema de deteção automática — é o registo do que o
-- operador observou e classificou.

create type detection_classification as enum ('identificada_autorizada', 'suspeita', 'nao_identificada');

create table detections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references service_sessions(id) on delete set null,
  mission_id uuid references missions(id) on delete set null,
  system_id uuid references counter_drone_systems(id) on delete set null,
  operator_id uuid not null references profiles(id) on delete cascade,

  classification detection_classification not null default 'nao_identificada',
  detection_type text,              -- ex: RF, Radar, Óptico, Acústico
  azimuth_deg numeric,               -- direção/azimute, quando disponível
  distance_m numeric,
  duration_seconds integer,

  lat double precision,
  lng double precision,
  location_label text,

  result text,                      -- o que aconteceu (ex: identificado, escalado, ignorado)
  notes text,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table detection_photos (
  id uuid primary key default gen_random_uuid(),
  detection_id uuid not null references detections(id) on delete cascade,
  photo_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- Uma ocorrência pode ter tido origem numa deteção
alter table incidents
  add column if not exists detection_id uuid references detections(id) on delete set null;

create index idx_detections_system on detections(system_id);
create index idx_detections_operator on detections(operator_id);

alter table detections enable row level security;
alter table detection_photos enable row level security;

create policy "detections_select" on detections for select
  using (operator_id = auth.uid() or current_user_role() in ('admin','gestor'));
create policy "detections_write" on detections for all
  using (operator_id = auth.uid() or current_user_role() in ('admin','gestor'))
  with check (operator_id = auth.uid() or current_user_role() in ('admin','gestor'));

create policy "detection_photos_select" on detection_photos for select
  using (
    exists (select 1 from detections d where d.id = detection_id and (d.operator_id = auth.uid() or current_user_role() in ('admin','gestor')))
  );
create policy "detection_photos_insert" on detection_photos for insert
  with check (
    exists (select 1 from detections d where d.id = detection_id and d.operator_id = auth.uid())
  );
