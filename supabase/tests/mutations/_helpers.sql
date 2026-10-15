-- Helpers for the mutation files. Loaded before each mutation by mutations.sh.
create schema if not exists m;

-- Replaces one piece of text in a function's definition and re-creates the function. The text must
-- occur exactly once: a stale mutation (the function changed) fails loudly instead of doing nothing.
create or replace function m.patch_fn(sig text, old text, new text) returns void
language plpgsql as $$
declare
  def text := pg_get_functiondef(sig::regprocedure);
  n int := (length(def) - length(replace(def, old, ''))) / greatest(length(old), 1);
begin
  if n <> 1 then
    raise exception 'mutation target occurs % times (expected 1) in %: %', n, sig, old;
  end if;
  execute replace(def, old, new);
end $$;
