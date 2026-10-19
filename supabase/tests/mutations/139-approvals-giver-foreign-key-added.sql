-- mutation: the giver is a foreign key to auth.users again (D-309 removed it)
alter table approvals add constraint m_giver_fk foreign key (approved_by) references auth.users (id);
