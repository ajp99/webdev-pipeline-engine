-- 0002_advance_stage.sql (task P1-T07)
-- Replaces the advance_stage() stub from 0001 with the real approval checks. No table or column
-- changes. Owner-approved on 2026-10-08 with the artifact mapping below. Hardening changes found in
-- the branch review and the migration review of 2026-10-15 (nothing is applied yet, so they are
-- folded in here):
--   * approval_is_valid(): an approval counts only if it was given by an owner (soft, hard) or by
--     the project's named client signer (client), so a wrongly attributed row, or a second client
--     login, cannot advance a project (D-238);
--   * a trigger stamps approvals.at with the database time for rows written through the API, so
--     nobody can post-date an approval to get round the owner-first order of the prototype stage;
--   * the client approval policy for the prototype also needs the owner's approval first
--     (an approval is permanent, so a too-early one would block the stage for that version), and
--     only the signer can insert a client approval;
--   * advance_stage() is for the owner only (the worker never advances a project), and the
--     handover to closed step goes through close_project() from 0001 (retention_until, and the
--     refusal while an accepted change request is undeployed, D-237);
--   * a handover guide can be made client-visible only after the owner's hard approval (D-251);
--   * (review panel, D-263 to D-296) helpers live in the private schema and every security-definer
--     function has an empty search_path; advance_stage() requires each gate's approval in the role of
--     its effective gatekeeper (D-272).
--
-- A project moves forward only through this function, only one stage at a time (the order of the
-- stage enum is the order in docs/spec/stages.yaml), and only while it is active.
--
-- Which artifact's approvals gate each stage (artifacts.type):
--   intake=intake_record  requirements=prd  plan=plan  prototype=prototype
--   qc_report=report  deploy_prep=deployment_checklist  handover=handover_guide
--   build_rounds: one round_summary artifact per round (version = round number), see below.
-- Approvals on any other artifact type (for example release_note, D-223) never count.
--
-- Required approvals for a stage = the gate types in gate_config for that stage: the global
-- defaults plus any gate types the project adds with its own rows. A project row never removes a
-- global gate; it can only add one or change its gatekeeper and deadline.
-- The approvals must sit on the newest version of the artifact (not superseded). When a stage has
-- an owner gate and a client gate (prototype), the client approval must come at or after an owner
-- approval on the same version.
--
-- build_rounds: leaves only when the project has at least one build round and every build round
-- (change-request mini-rounds are ignored) has status approved and a soft approval on its newest
-- round_summary. A round_summary artifact carries {"round": N} in its content; Feedback on a round
-- makes a new version for the same N, and versions are unique per project, so they rise across rounds.
--
-- handover -> closed also sets status closed and close_reason completed in the same call (D-220),
-- through close_project(), which also sets retention_until.
-- An approval counts only when its giver fits its role: an owner for the owner gates, the named
-- signer of this project for the client gate. If the owner changes the signer later, the former
-- signer's approvals stop counting and the new signer approves again.
create or replace function private.approval_is_valid(ap public.approvals, p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case ap.role
    when 'owner'  then exists (select 1 from public.owners o where o.id = ap.approved_by)
    when 'client' then exists (select 1 from public.clients c
                               where c.id = ap.approved_by and c.project_id = p_project and c.is_signer)
    else false end
$$;
-- Only advance_stage() (which runs as its owner) calls it, so no API role needs execute.
revoke all on function private.approval_is_valid(public.approvals, uuid) from public, anon, authenticated, service_role;

-- An approval written through the API gets the database time as its time. Rows written by the
-- SQL editor or a migration (current_user is postgres) keep the time they carry.
create or replace function stamp_approval_time() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated', 'service_role') then
    new.at := now();
  end if;
  return new;
end;
$$;
create trigger approvals_stamp_time before insert on approvals
  for each row execute function stamp_approval_time();

-- D-251: a handover guide becomes visible to the client only after the owner's hard approval of
-- that version.
create or replace function guard_handover_guide_visibility() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated', 'service_role')
     and new.type = 'handover_guide' and new.client_visible
     and not exists (select 1 from approvals ap join owners o on o.id = ap.approved_by
                     where ap.artifact_id = new.id and ap.gate_type = 'hard' and ap.role = 'owner') then
    raise exception 'a handover guide is shown to the client only after the owner''s hard approval';
  end if;
  return new;
end;
$$;
create trigger artifacts_handover_visibility before insert or update of client_visible on artifacts
  for each row execute function guard_handover_guide_visibility();

-- The client signs the prototype only after the owner approved that version.
create or replace function private.artifact_has_owner_approval(p_artifact uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.approvals ap where ap.artifact_id = p_artifact and ap.role = 'owner')
$$;
revoke all on function private.artifact_has_owner_approval(uuid) from public, anon;
grant execute on function private.artifact_has_owner_approval(uuid) to authenticated, service_role;

drop policy client_add_approval on approvals;
create policy client_add_approval on approvals
  for insert to authenticated with check (
    role = 'client' and gate_type = 'client' and approved_by = auth.uid()
    and exists (select 1 from clients c where c.id = auth.uid() and c.is_signer)
    and exists (select 1 from artifacts a
                where a.id = artifact_id and a.project_id = private.client_project_id()
                  and a.client_visible and a.status <> 'superseded'
                  and ((a.type = 'prd' and private.client_project_in(array['requirements']::stage[]))
                    or (a.type = 'prototype' and private.client_project_in(array['prototype']::stage[])
                        and private.artifact_has_owner_approval(a.id))))
  );

create or replace function advance_stage(p_project uuid, p_next stage) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v         public.projects%rowtype;
  stages    public.stage[] := enum_range(null::public.stage);
  idx       int;
  atype     public.artifact_type;
  art       public.artifacts%rowtype;
  gt        public.gate_type;
  gk        public.approver_role;
  req       public.gate_type[];
begin
  if not private.is_owner() then
    raise exception 'advance_stage: not allowed';
  end if;

  select * into v from public.projects where id = p_project for update;
  if not found then
    raise exception 'advance_stage: project not found';
  end if;
  if v.status <> 'active' then
    raise exception 'advance_stage: project is %, only an active project can advance', v.status;
  end if;
  if v.stage = 'closed' then
    raise exception 'advance_stage: project is already closed';
  end if;

  idx := array_position(stages, v.stage);
  if p_next is distinct from stages[idx + 1] then
    raise exception 'advance_stage: % is not the stage after %', p_next, v.stage;
  end if;

  if v.stage = 'build_rounds' then
    if not exists (select 1 from public.rounds where project_id = p_project and change_request_id is null) then
      raise exception 'advance_stage: no build rounds exist yet';
    end if;
    if exists (
      select 1 from public.rounds r
      where r.project_id = p_project and r.change_request_id is null
        and (r.status <> 'approved'
          or not exists (
            select 1 from public.artifacts a join public.approvals ap on ap.artifact_id = a.id
            where a.project_id = p_project and a.type = 'round_summary'
              and a.content ->> 'round' = r.number::text
              and a.status <> 'superseded' and ap.gate_type = 'soft'
              and private.approval_is_valid(ap, p_project)
              and a.version = (select max(b.version) from public.artifacts b
                               where b.project_id = p_project and b.type = 'round_summary'
                                 and b.content ->> 'round' = r.number::text)))
    ) then
      raise exception 'advance_stage: every build round must be approved with a soft approval on its newest round_summary';
    end if;
  else
    atype := case v.stage
      when 'intake'       then 'intake_record'
      when 'requirements' then 'prd'
      when 'plan'         then 'plan'
      when 'prototype'    then 'prototype'
      when 'qc_report'    then 'report'
      when 'deploy_prep'  then 'deployment_checklist'
      when 'handover'     then 'handover_guide'
    end;

    select * into art from public.artifacts
      where project_id = p_project and type = atype
      order by version desc limit 1;
    if not found or art.status = 'superseded' then
      raise exception 'advance_stage: no current % artifact to approve for stage %', atype, v.stage;
    end if;

    select array_agg(distinct g.gate_type) into req
      from public.gate_config g
      where g.stage = v.stage and (g.project_id is null or g.project_id = p_project);

    -- Each gate needs a valid approval given in the role of its effective gatekeeper (the project's own
    -- row first, then the global default, D-272).
    foreach gt in array req loop
      select g.gatekeeper into gk from public.gate_config g
        where g.stage = v.stage and g.gate_type = gt and (g.project_id is null or g.project_id = p_project)
        order by g.project_id nulls last limit 1;
      if not exists (select 1 from public.approvals ap
                     where ap.artifact_id = art.id and ap.gate_type = gt and ap.role = gk
                       and private.approval_is_valid(ap, p_project)) then
        raise exception 'advance_stage: missing % approval on % v% for stage %', gt, atype, art.version, v.stage;
      end if;
    end loop;

    if 'client' = any (req) and array_length(req, 1) > 1 then
      if not exists (
        select 1 from public.approvals c join public.approvals o on o.artifact_id = c.artifact_id
        where c.artifact_id = art.id and c.gate_type = 'client' and o.gate_type <> 'client' and o.at <= c.at
          and private.approval_is_valid(c, p_project) and private.approval_is_valid(o, p_project)
      ) then
        raise exception 'advance_stage: the client approval must come after an owner approval';
      end if;
    end if;
  end if;

  perform set_config('app.stage_advance', 'on', true);
  if v.stage = 'handover' then
    update public.projects set stage = p_next where id = p_project;
    perform private.close_project(p_project, 'completed');
  else
    update public.projects set stage = p_next where id = p_project;
  end if;
  perform set_config('app.stage_advance', 'off', true);
end;
$$;
grant execute on function advance_stage(uuid, stage) to authenticated;
