-- mutation: any spam protection value is accepted
select m.patch_fn($q$private.prd_content_problem(jsonb)$q$, $q$or (c ->> 'spam_protection') not in ('honeypot', 'turnstile', 'no_contact_form')$q$, $q$$q$);
