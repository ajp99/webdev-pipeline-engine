-- mutation: the owner need not write a change summary
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if (p_content ->> 'change_summary') !~ '\S' then$q$, $q$if false then$q$);
