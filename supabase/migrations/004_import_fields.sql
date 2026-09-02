-- ============================================================
-- MIGRAÇÃO: campos de estrutura orgânica (importação GIOP) e
-- metadados adicionais de missão vindos do registo de serviços
-- ============================================================

alter table profiles
  add column if not exists nm text unique,          -- número mecanográfico
  add column if not exists posto text,               -- posto/graduação
  add column if not exists subunidade text,
  add column if not exists pelotao text,
  add column if not exists area_funcional text,
  add column if not exists phone_extra text;          -- mantém "phone" já existente livre para outro uso se necessário

alter table missions
  add column if not exists category text,            -- ex: Exercício, Recolha de Imagens, Apoio a Operação
  add column if not exists tipo_servico text,         -- 'UAS' ou 'C-UAS' (tal como no registo original)
  add column if not exists notam_number text,
  add column if not exists uas_used_label text;       -- texto livre do equipamento usado, quando não corresponde a um drone registado
