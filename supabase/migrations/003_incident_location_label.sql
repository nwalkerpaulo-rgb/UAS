-- ============================================================
-- MIGRAÇÃO: nome do local em ocorrências (localização manual,
-- independente do GPS)
-- Corre isto no SQL Editor do Supabase se já tiveres corrido o
-- schema.sql antes desta alteração.
-- ============================================================

alter table incidents
  add column if not exists location_label text;
