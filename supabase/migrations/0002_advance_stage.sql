-- 0002_advance_stage.sql (task P1-T07)
-- Replaces the advance_stage() stub from 0001 with the real approval checks. No table or column
-- changes. Owner-approved on 2026-10-08 with the artifact mapping below. Three hardening changes
-- found in the branch review are included and need the owner's review too (nothing is applied yet):
--   * approval_is_valid(): an approval counts only if it was given by an owner (soft, hard) or by a
--     client of this project (client), so a wrongly attributed row cannot advance a project;
--   * a trigger stamps approvals.at no later than now(), so a client cannot post-date an approval
--     to get round the owner-first order of the prototype stage;
--   * the client approval policy for the prototype now also needs the owner's approval first
--     (an approval is permanent, so a too-early one would block the stage for that version).
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
-- handover -> closed also sets status closed and close_reason completed in the same call (D-220).
-- An approval counts only when its giver fits its role: an owner for the owner gates, a client of
-- this project for the client gate.
create or replace function approval_is_valid(ap approvals, p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case ap.role
    when 'owner'  then exists (select 1 from owners o where o.id = ap.approved_by)
    when 'client' then exists (select 1 from clients c where c.id = ap.approved_by and c.project_id = p_project)
    else false end
$$;
revoke all on function approval_is_valid(approvals, uuid) from public;
grant execute on function approval_is_valid(approvals, uuid) to authenticated, service_role;

-- An approval is stamped no later than the moment it is written.
create or replace function clamp_approval_time() returns trigger
language plpgsql as $$
begin
  if new.at > now() then new.at := now(); end if;
  return new;
end;
$$;
create trigger approvals_clamp_time before insert on approvals
  for each row execute function clamp_approval_time();

-- The client signs the prototype only after the owner approved that version.
create or replace function artifact_has_owner_approval(p_artifact uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from approvals ap where ap.artifact_id = p_artifact and ap.role = 'owner')
$$;
revoke all on function artifact_has_owner_approval(uuid) from public;
grant execute on function artifact_has_owner_approval(uuid) to authenticated, service_role;

drop policy client_add_approval on approvals;
create policy client_add_approval on approvals
  for insert to authenticated with check (
    role = 'client' and gate_type = 'client' and approved_by = auth.uid()
    and exists (select 1 from artifacts a
                where a.id = artifact_id and a.project_id = public.client_project_id()
                  and a.client_visible and a.status <> 'superseded'
                  and ((a.type = 'prd' and public.client_project_in(array['requirements']::stage[]))
                    or (a.type = 'prototype' and public.client_project_in(array['prototype']::stage[])
                        and public.artifact_has_owner_approval(a.id))))
  );

create or replace function advance_stage(p_project uuid, p_next stage) returns void
language plpgsql security definer set search_path = public as $$
declare
  v         projects%rowtype;
  stages    stage[] := enum_range(null::stage);
  idx       int;
  atype     text;
  art       artifacts%rowtype;
  gt        gate_type;
  req       gate_type[];
begin
  if not (public.is_owner() or public.is_service_role()) then
    raise exception 'advance_stage: not allowed';
  end if;

  select * into v from projects where id = p_project for update;
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
    if not exists (select 1 from rounds where project_id = p_project and change_request_id is null) then
      raise exception 'advance_stage: no build rounds exist yet';
    end if;
    if exists (
      select 1 from rounds r
      where r.project_id = p_project and r.change_request_id is null
        and (r.status <> 'approved'
          or not exists (
            select 1 from artifacts a join approvals ap on ap.artifact_id = a.id
            where a.project_id = p_project and a.type = 'round_summary'
              and a.content ->> 'round' = r.number::text
              and a.status <> 'superseded' and ap.gate_type = 'soft'
              and public.approval_is_valid(ap, p_project)
              and a.version = (select max(b.version) from artifacts b
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

    select * into art from artifacts
      where project_id = p_project and type = atype
      order by version desc limit 1;
    if not found or art.status = 'superseded' then
      raise exception 'advance_stage: no current % artifact to approve for stage %', atype, v.stage;
    end if;

    select array_agg(distinct g.gate_type) into req
      from gate_config g
      where g.stage = v.stage and (g.project_id is null or g.project_id = p_project);

    foreach gt in array req loop
      if not exists (select 1 from approvals ap
                     where ap.artifact_id = art.id and ap.gate_type = gt
                       and public.approval_is_valid(ap, p_project)) then
        raise exception 'advance_stage: missing % approval on % v% for stage %', gt, atype, art.version, v.stage;
      end if;
    end loop;

    if 'client' = any (req) and array_length(req, 1) > 1 then
      if not exists (
        select 1 from approvals c join approvals o on o.artifact_id = c.artifact_id
        where c.artifact_id = art.id and c.gate_type = 'client' and o.gate_type <> 'client' and o.at <= c.at
          and public.approval_is_valid(c, p_project) and public.approval_is_valid(o, p_project)
      ) then
        raise exception 'advance_stage: the client approval must come after an owner approval';
      end if;
    end if;
  end if;

  perform set_config('app.stage_advance', 'on', true);
  if v.stage = 'handover' then
    update projects set stage = p_next, status = 'closed', close_reason = 'completed'
      where id = p_project;
  else
    update projects set stage = p_next where id = p_project;
  end if;
  perform set_config('app.stage_advance', 'off', true);
end;
$$;
