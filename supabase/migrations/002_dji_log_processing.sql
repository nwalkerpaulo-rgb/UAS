-- ============================================================
-- MIGRAÇÃO: processamento de logs DJI
-- Corre isto no SQL Editor do Supabase DEPOIS do schema.sql
-- (ou, em projeto novo, já está incluído no schema.sql atualizado)
-- ============================================================

create type mission_log_status as enum ('pendente', 'a_processar', 'concluido', 'erro');

alter table missions
  add column if not exists log_status mission_log_status not null default 'pendente',
  add column if not exists log_error text,
  add column if not exists max_speed_mps numeric,
  add column if not exists battery_serial_seen text;

-- log_file_url passa a guardar o PATH dentro do bucket 'logs' (bucket privado),
-- não um URL público — necessário para o download no lado do servidor.
comment on column missions.log_file_url is 'Path dentro do bucket de storage "logs" (não é URL público — o bucket é privado)';
