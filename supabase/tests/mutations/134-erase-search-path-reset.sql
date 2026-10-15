-- mutation: erase_project_data has no search_path of its own
alter function erase_project_data(uuid) reset search_path;
