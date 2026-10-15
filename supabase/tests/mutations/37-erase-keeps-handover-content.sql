-- mutation: erase_project_data leaves the handover guide's content
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$update public.artifacts set content = '{}'::jsonb where project_id = p_project and type = 'handover_guide';$q$, $q$null;$q$);
