-- ============================================================
-- MIGRAÇÃO: corrigir recursão infinita entre RLS de
-- service_sessions e session_participants
--
-- Causa: a política de leitura de service_sessions verifica se o
-- utilizador é participante (consulta session_participants), e a
-- política de escrita de session_participants verifica o dono da
-- sessão (consulta service_sessions) — ciclo fechado, o Postgres
-- deteta e bloqueia com "infinite recursion detected".
--
-- Solução: funções SECURITY DEFINER, que fazem a verificação sem
-- voltar a passar pelas políticas RLS da tabela consultada.
-- ============================================================

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

-- Recria a política de leitura de service_sessions usando a função
drop policy if exists "sessions_select" on service_sessions;
create policy "sessions_select" on service_sessions for select
  using (
    created_by = auth.uid()
    or current_user_role() in ('admin', 'gestor')
    or is_session_participant(id)
  );

-- Recria as políticas de session_participants e session_assets usando a função
drop policy if exists "session_participants_write" on session_participants;
create policy "session_participants_write" on session_participants for all
  using (is_session_owner_or_admin(session_id));

drop policy if exists "session_assets_write" on session_assets;
create policy "session_assets_write" on session_assets for all
  using (is_session_owner_or_admin(session_id));

drop policy if exists "session_photos_select" on session_photos;
create policy "session_photos_select" on session_photos for select
  using (is_session_owner_or_admin(session_id) or is_session_participant(session_id));
