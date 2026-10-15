-- mutation: a new function in public is callable from the API
create function public.leaky() returns int language sql as 'select 1';
