-- mutation: a change request is recorded after the freeze
select m.patch_fn($q$guard_change_request()$q$, $q$if proj.changes_frozen_at is not null then$q$, $q$if false then$q$);
