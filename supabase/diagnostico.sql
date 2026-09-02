-- Corre isto no SQL Editor do Supabase para veres quais migrações já
-- foram aplicadas. Cada linha diz "sim" ou "falta correr".

select
  'schema base (perfis, drones, missões...)' as migracao,
  case when exists (select 1 from information_schema.tables where table_name = 'profiles') then 'sim' else 'falta correr schema.sql' end as estado
union all
select '002 — log_status em missions',
  case when exists (select 1 from information_schema.columns where table_name = 'missions' and column_name = 'log_status') then 'sim' else 'falta correr' end
union all
select '003 — status/investigador em incidents',
  case when exists (select 1 from information_schema.columns where table_name = 'incidents' and column_name = 'investigator_id') then 'sim' else 'falta correr' end
union all
select '004 — nm em profiles',
  case when exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'nm') then 'sim' else 'falta correr' end
union all
select '005 — planning_status em missions',
  case when exists (select 1 from information_schema.columns where table_name = 'missions' and column_name = 'planning_status') then 'sim' else 'falta correr' end
union all
select '006 — weather_snapshot em missions',
  case when exists (select 1 from information_schema.columns where table_name = 'missions' and column_name = 'weather_snapshot') then 'sim' else 'falta correr' end
union all
select '007 — funções is_session_participant / is_session_owner_or_admin',
  case when exists (select 1 from information_schema.routines where routine_name = 'is_session_participant') then 'sim' else 'falta correr' end
union all
select '008 — tabela detections',
  case when exists (select 1 from information_schema.tables where table_name = 'detections') then 'sim' else 'falta correr' end
union all
select '009 — tabela bases',
  case when exists (select 1 from information_schema.tables where table_name = 'bases') then 'sim' else 'falta correr' end
union all
select '010 — tabela app_settings',
  case when exists (select 1 from information_schema.tables where table_name = 'app_settings') then 'sim' else 'falta correr' end;
