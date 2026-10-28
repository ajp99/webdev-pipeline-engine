-- mutation: question id format is not checked
alter table intake_responses drop constraint intake_question_id;
