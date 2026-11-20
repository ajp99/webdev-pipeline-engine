---
name: smtp-contact-form/configure-form
description: Configure the starter's contact form route: fields, spam protection, transport and the failure screen.
version: 1
---

# Configure form

## Preconditions

- The PRD's features (fields wanted) and its spam protection choice: honeypot, turnstile or no_contact_form.

## Steps

1. If the PRD says no_contact_form, remove the contact section and route, and link phone and email instead.
2. Fields: name, email and message by default; add only what the PRD lists. Every field has a label and server-side validation.
3. Spam protection on every form: the honeypot field, the minimum fill time check and the best-effort rate limit stay on. Add Cloudflare Turnstile only when the PRD's choice is turnstile.
4. Transport: read the SMTP settings from environment variables only (generic SMTP, Google Workspace or a Gmail app password, Microsoft 365 OAuth 2.0). Never commit credentials; document the variables in `.env.example`.
5. On failure, show the failure screen with the phone number and plain contact links.
6. Use the stubbed transport in tests; check a valid message is sent, and that a honeypot hit or a too-fast submit is dropped quietly.

## Decision guidance

- Add auto-reply, a consent checkbox or attachments only when the PRD asks.
- Never send the form to a third-party form service.
