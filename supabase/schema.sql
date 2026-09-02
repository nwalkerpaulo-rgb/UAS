-- ============================================================
-- SCHEMA: Gestão de Drones e Contra-Drones
-- Base de dados: Supabase (Postgres)
-- ============================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- UTILIZADORES / PERFIS
-- ============================================================
-- Nota: auth.users já é gerido pelo Supabase Auth.
-- Esta tabela guarda o perfil e função de cada utilizador autenticado.

create type user_role as enum ('admin', 'gestor', 'piloto', 'observador');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  photo_url text,
  role user_role not null default 'piloto',
  active boolean not null default true,
  nm text unique,             -- número mecanográfico
  posto text,                  -- posto/graduação
  subunidade text,
  pelotao text,
  area_funcional text,
  created_at timestamptz not null default now()
);

-- Certificações / habilitações do piloto
create table certifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null,              -- ex: 'A1/A3', 'A2', 'Operador Certificado'
  certificate_number text,
  issued_at date,
  expires_at date,
  document_url text,               -- ficheiro digitalizado no Supabase Storage
  created_at timestamptz not null default now()
);

-- Certificado médico
create table medical_certificates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  expires_at date,
  document_url text,
  created_at timestamptz not null default now()
);

-- Registo de formação / treino
create table trainings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  completed_at date,
  document_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ATIVOS: DRONES, BATERIAS, CONTRA-DRONE, EQUIPAMENTO
-- ============================================================

create type asset_status as enum ('operacional', 'manutencao', 'inativo');

create table drones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text not null,
  serial_number text unique not null,
  acquired_at date,
  status asset_status not null default 'operacional',
  total_flight_seconds integer not null default 0,  -- acumulado dos logs
  next_maintenance_at date,
  next_maintenance_hours integer,                    -- alerta por horas de voo
  photo_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table batteries (
  id uuid primary key default gen_random_uuid(),
  drone_id uuid references drones(id) on delete set null, -- bateria pode não estar afeta a um drone fixo
  model text not null,
  serial_number text unique not null,
  cycle_count integer not null default 0,
  total_flight_seconds integer not null default 0,
  health_pct integer,                                -- se o log trouxer info de saúde
  status asset_status not null default 'operacional',
  next_maintenance_cycles integer,
  created_at timestamptz not null default now()
);

create table counter_drone_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text not null,
  serial_number text unique not null,
  system_type text,             -- ex: 'RF Detection', 'Radar', 'Jamming', 'Optico'
  status asset_status not null default 'operacional',
  next_maintenance_at date,
  notes text,
  created_at timestamptz not null default now()
);

-- Baterias também podem pertencer a um sistema C-UAS em vez de um drone
alter table batteries
  add column counter_drone_system_id uuid references counter_drone_systems(id) on delete set null;

create table equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,           -- ex: payload, comando, tablet, case
  serial_number text,
  status asset_status not null default 'operacional',
  checked_out_by uuid references profiles(id) on delete set null,
  checked_out_at timestamptz,
  next_maintenance_at date,
  created_at timestamptz not null default now()
);

-- Histórico de manutenção (genérico, ligado a qualquer tipo de ativo)
create type maintenance_asset_type as enum ('drone', 'bateria', 'contra_drone', 'equipamento');

create table maintenance_records (
  id uuid primary key default gen_random_uuid(),
  asset_type maintenance_asset_type not null,
  asset_id uuid not null,        -- id do drone/bateria/contra_drone/equipamento
  performed_by uuid references profiles(id) on delete set null,
  performed_at date not null default current_date,
  description text not null,
  next_due_at date,
  next_due_hours integer,
  next_due_cycles integer,
  document_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SESSÕES (INÍCIO/FIM DE SERVIÇO)
-- ============================================================

create type session_status as enum ('aberta', 'fechada', 'completa');

create table service_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id) on delete cascade,
  status session_status not null default 'aberta',

  started_at timestamptz not null default now(),
  start_lat double precision,
  start_lng double precision,
  start_location_label text,

  ended_at timestamptz,
  end_lat double precision,
  end_lng double precision,
  end_location_label text,

  notes text,
  created_at timestamptz not null default now()
);

-- Pilotos/utilizadores presentes numa sessão (M:N)
create table session_participants (
  session_id uuid not null references service_sessions(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role_in_session text,          -- ex: 'piloto', 'observador', 'operador payload'
  primary key (session_id, profile_id)
);

-- Ativos usados numa sessão (M:N, genérico)
create table session_assets (
  session_id uuid not null references service_sessions(id) on delete cascade,
  asset_type maintenance_asset_type not null,
  asset_id uuid not null,
  primary key (session_id, asset_type, asset_id)
);

-- Fotos associadas à sessão
create table session_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references service_sessions(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  photo_url text not null,
  caption text,
  taken_at timestamptz not null default now()
);

-- ============================================================
-- MISSÕES
-- ============================================================

create type mission_origin as enum ('log_importado', 'manual');
create type mission_status as enum ('concluida', 'falhada', 'cua');
create type mission_log_status as enum ('pendente', 'a_processar', 'concluido', 'erro');
create type mission_planning_status as enum ('planeada', 'pronta', 'em_curso', 'concluida', 'cancelada');
create type mission_risk as enum ('baixo', 'medio', 'alto');

create table missions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references service_sessions(id) on delete set null,
  pilot_id uuid not null references profiles(id) on delete cascade,
  drone_id uuid references drones(id) on delete set null,
  counter_drone_system_id uuid references counter_drone_systems(id) on delete set null,
  battery_id uuid references batteries(id) on delete set null,

  origin mission_origin not null default 'manual',
  status mission_status not null default 'concluida',

  started_at timestamptz,
  ended_at timestamptz,
  flight_seconds integer,          -- tempo de voo em segundos
  distance_meters numeric,
  max_altitude_meters numeric,

  area_label text,
  lat double precision,
  lng double precision,

  log_file_url text,               -- path dentro do bucket privado "logs" (não é URL público)
  log_processed boolean not null default false,
  log_status mission_log_status not null default 'pendente',
  log_error text,
  max_speed_mps numeric,
  battery_serial_seen text,        -- nº de série da bateria lido do log (para conferência)

  category text,                   -- ex: Exercício, Recolha de Imagens, Apoio a Operação
  tipo_servico text,                -- 'UAS' ou 'C-UAS'
  notam_number text,
  uas_used_label text,             -- texto livre do equipamento, quando não corresponde a um drone registado

  planning_status mission_planning_status not null default 'concluida',
  scheduled_at timestamptz,
  objective text,
  risk_level mission_risk,
  observer_id uuid references profiles(id) on delete set null,
  payload text,
  expected_duration_min integer,
  checklist_pilot_ok boolean not null default false,
  checklist_drone_ok boolean not null default false,
  checklist_battery_ok boolean not null default false,
  checklist_maintenance_ok boolean not null default false,
  checklist_area_ok boolean not null default false,
  checklist_docs_ok boolean not null default false,
  weather_snapshot jsonb,           -- dados meteo (Open-Meteo) no momento do planeamento
  plan_lat double precision,
  plan_lng double precision,

  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INCIDENTES
-- ============================================================

create type incident_severity as enum ('baixa', 'media', 'alta', 'critica');
create type incident_status as enum ('reportada', 'em_investigacao', 'fechada');

create table incidents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references service_sessions(id) on delete set null,
  mission_id uuid references missions(id) on delete set null,
  reported_by uuid not null references profiles(id) on delete cascade,
  investigator_id uuid references profiles(id) on delete set null,
  title text,
  severity incident_severity not null default 'baixa',
  status incident_status not null default 'reportada',
  description text not null,
  actions_taken text,
  location_label text,
  lat double precision,
  lng double precision,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table incident_photos (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  photo_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- DETEÇÕES C-UAS
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
  detection_type text,
  azimuth_deg numeric,
  distance_m numeric,
  duration_seconds integer,

  lat double precision,
  lng double precision,
  location_label text,

  result text,
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

alter table incidents
  add column detection_id uuid references detections(id) on delete set null;

create index idx_detections_system on detections(system_id);
create index idx_detections_operator on detections(operator_id);

-- ============================================================
-- ÍNDICES ÚTEIS
-- ============================================================
create index idx_missions_pilot on missions(pilot_id);
create index idx_missions_drone on missions(drone_id);
create index idx_missions_session on missions(session_id);
create index idx_sessions_created_by on service_sessions(created_by);
create index idx_maintenance_asset on maintenance_records(asset_type, asset_id);
create index idx_certifications_profile on certifications(profile_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Regra geral: admin/gestor vê tudo. Piloto vê o que criou ou onde participou.

alter table profiles enable row level security;
alter table certifications enable row level security;
alter table medical_certificates enable row level security;
alter table trainings enable row level security;
alter table drones enable row level security;
alter table batteries enable row level security;
alter table counter_drone_systems enable row level security;
alter table equipment enable row level security;
alter table maintenance_records enable row level security;
alter table service_sessions enable row level security;
alter table session_participants enable row level security;
alter table session_assets enable row level security;
alter table session_photos enable row level security;
alter table missions enable row level security;
alter table incidents enable row level security;
alter table incident_photos enable row level security;
alter table detections enable row level security;
alter table detection_photos enable row level security;

-- Função auxiliar: devolve a função do utilizador autenticado
create or replace function current_user_role()
returns user_role
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- Funções auxiliares para sessões — SECURITY DEFINER para evitar recursão
-- entre as políticas de service_sessions e session_participants (que se
-- referenciam mutuamente).
create or replace function is_session_participant(session_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from session_participants
    where session_id = session_uuid and profile_id = auth.uid()
  );
$$;

create or replace function is_session_owner_or_admin(session_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from service_sessions
    where id = session_uuid
      and (created_by = auth.uid() or current_user_role() in ('admin', 'gestor'))
  );
$$;

-- PROFILES: todos autenticados podem ver a lista (para escolher pilotos numa sessão);
-- só admin/gestor pode editar outros perfis.
create policy "profiles_select_all" on profiles for select
  using (auth.role() = 'authenticated');
create policy "profiles_update_self_or_admin" on profiles for update
  using (id = auth.uid() or current_user_role() in ('admin','gestor'));
create policy "profiles_insert_admin" on profiles for insert
  with check (current_user_role() in ('admin','gestor') or id = auth.uid());

-- ATIVOS (drones, baterias, contra-drone, equipamento): leitura para todos autenticados,
-- escrita só admin/gestor.
create policy "drones_select" on drones for select using (auth.role() = 'authenticated');
create policy "drones_write" on drones for all
  using (current_user_role() in ('admin','gestor'))
  with check (current_user_role() in ('admin','gestor'));

create policy "batteries_select" on batteries for select using (auth.role() = 'authenticated');
create policy "batteries_write" on batteries for all
  using (current_user_role() in ('admin','gestor'))
  with check (current_user_role() in ('admin','gestor'));

create policy "counter_drone_select" on counter_drone_systems for select using (auth.role() = 'authenticated');
create policy "counter_drone_write" on counter_drone_systems for all
  using (current_user_role() in ('admin','gestor'))
  with check (current_user_role() in ('admin','gestor'));

create policy "equipment_select" on equipment for select using (auth.role() = 'authenticated');
create policy "equipment_write" on equipment for all
  using (current_user_role() in ('admin','gestor'))
  with check (current_user_role() in ('admin','gestor'));

create policy "maintenance_select" on maintenance_records for select using (auth.role() = 'authenticated');
create policy "maintenance_write" on maintenance_records for all
  using (current_user_role() in ('admin','gestor'))
  with check (current_user_role() in ('admin','gestor'));

-- CERTIFICAÇÕES / MÉDICO / FORMAÇÃO: dono vê o seu, admin/gestor vê tudo
create policy "certifications_select" on certifications for select
  using (profile_id = auth.uid() or current_user_role() in ('admin','gestor'));
create policy "certifications_write" on certifications for all
  using (profile_id = auth.uid() or current_user_role() in ('admin','gestor'))
  with check (profile_id = auth.uid() or current_user_role() in ('admin','gestor'));

create policy "medical_select" on medical_certificates for select
  using (profile_id = auth.uid() or current_user_role() in ('admin','gestor'));
create policy "medical_write" on medical_certificates for all
  using (profile_id = auth.uid() or current_user_role() in ('admin','gestor'))
  with check (profile_id = auth.uid() or current_user_role() in ('admin','gestor'));

create policy "trainings_select" on trainings for select
  using (profile_id = auth.uid() or current_user_role() in ('admin','gestor'));
create policy "trainings_write" on trainings for all
  using (profile_id = auth.uid() or current_user_role() in ('admin','gestor'))
  with check (profile_id = auth.uid() or current_user_role() in ('admin','gestor'));

-- SESSÕES: dono ou participante vê a sua; admin/gestor vê todas
create policy "sessions_select" on service_sessions for select
  using (
    created_by = auth.uid()
    or current_user_role() in ('admin','gestor')
    or is_session_participant(id)
  );
create policy "sessions_insert" on service_sessions for insert
  with check (created_by = auth.uid());
create policy "sessions_update" on service_sessions for update
  using (created_by = auth.uid() or current_user_role() in ('admin','gestor'));

create policy "session_participants_select" on session_participants for select
  using (auth.role() = 'authenticated');
create policy "session_participants_write" on session_participants for all
  using (is_session_owner_or_admin(session_id));

create policy "session_assets_select" on session_assets for select using (auth.role() = 'authenticated');
create policy "session_assets_write" on session_assets for all
  using (is_session_owner_or_admin(session_id));

create policy "session_photos_select" on session_photos for select
  using (is_session_owner_or_admin(session_id) or is_session_participant(session_id));
create policy "session_photos_insert" on session_photos for insert
  with check (uploaded_by = auth.uid());

-- MISSÕES: piloto vê as suas, admin/gestor vê todas
create policy "missions_select" on missions for select
  using (pilot_id = auth.uid() or current_user_role() in ('admin','gestor'));
create policy "missions_write" on missions for all
  using (pilot_id = auth.uid() or current_user_role() in ('admin','gestor'))
  with check (pilot_id = auth.uid() or current_user_role() in ('admin','gestor'));

-- INCIDENTES: reporter vê os seus, admin/gestor vê todos
create policy "incidents_select" on incidents for select
  using (reported_by = auth.uid() or current_user_role() in ('admin','gestor'));
create policy "incidents_write" on incidents for all
  using (reported_by = auth.uid() or current_user_role() in ('admin','gestor'))
  with check (reported_by = auth.uid() or current_user_role() in ('admin','gestor'));

create policy "incident_photos_select" on incident_photos for select
  using (
    exists (select 1 from incidents i where i.id = incident_id and (i.reported_by = auth.uid() or current_user_role() in ('admin','gestor')))
  );
create policy "incident_photos_insert" on incident_photos for insert
  with check (
    exists (select 1 from incidents i where i.id = incident_id and i.reported_by = auth.uid())
  );

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

-- ============================================================
-- BASES / PONTOS DE LANÇAMENTO
-- ============================================================

create table bases (
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

create policy "bases_select" on bases for select using (auth.role() = 'authenticated');
create policy "bases_write" on bases for all
  using (current_user_role() in ('admin','gestor'))
  with check (current_user_role() in ('admin','gestor'));

-- ============================================================
-- DEFINIÇÕES DA ORGANIZAÇÃO (singleton)
-- ============================================================

create table app_settings (
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

create policy "app_settings_select" on app_settings for select using (auth.role() = 'authenticated');
create policy "app_settings_update" on app_settings for update
  using (current_user_role() in ('admin','gestor'))
  with check (current_user_role() in ('admin','gestor'));

-- ============================================================
-- STORAGE BUCKETS (correr no dashboard Supabase ou via API)
-- ============================================================
-- bucket "documents"  -> certificações, médico, formação, manutenção (privado)
-- bucket "photos"     -> fotos de sessão e incidentes (privado)
-- bucket "logs"       -> ficheiros .DAT/.txt de voo (privado)
