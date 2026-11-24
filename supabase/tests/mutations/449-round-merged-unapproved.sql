-- mutation: round-merged-unapproved
alter table rounds drop constraint round_merged_only_when_approved;
