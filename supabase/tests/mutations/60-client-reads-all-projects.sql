-- mutation: a client may read every project
alter policy client_read_own_project on projects using (true);
