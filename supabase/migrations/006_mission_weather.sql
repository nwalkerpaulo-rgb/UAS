-- ============================================================
-- MIGRAÇÃO: meteorologia no planeamento de missão
-- ============================================================

alter table missions
  add column if not exists weather_snapshot jsonb,   -- dados meteo no momento do planeamento
  add column if not exists plan_lat double precision,
  add column if not exists plan_lng double precision;

comment on column missions.weather_snapshot is 'Snapshot da meteorologia (Open-Meteo) no momento do planeamento — não é atualizado depois';
