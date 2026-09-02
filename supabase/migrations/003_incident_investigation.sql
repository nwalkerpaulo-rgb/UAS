-- ============================================================
-- MIGRAÇÃO: fluxo de investigação de ocorrências
-- ============================================================

create type incident_status as enum ('reportada', 'em_investigacao', 'fechada');

alter table incidents
  add column if not exists status incident_status not null default 'reportada',
  add column if not exists investigator_id uuid references profiles(id) on delete set null,
  add column if not exists title text,
  add column if not exists location_label text;

comment on column incidents.title is 'Título curto da ocorrência (opcional — se vazio, usa-se a descrição)';
