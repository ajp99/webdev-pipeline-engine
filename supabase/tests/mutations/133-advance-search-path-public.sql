-- mutation: advance_stage searches public
alter function advance_stage(uuid, stage) set search_path = public;
