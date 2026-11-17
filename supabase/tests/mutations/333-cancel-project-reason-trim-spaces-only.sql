-- mutation: the reason is trimmed of spaces only, so line breaks count as text
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$regexp_replace(coalesce(p_reason, ''), '^\s+|\s+$', '', 'g')$q$, $q$btrim(coalesce(p_reason, ''))$q$);
