---
name: deployment/production-release
description: Prepare a site for its production release: environment, build on staging, claim markers, DNS records.
version: 1
---

# Production release

## Preconditions

- All rounds approved and QC passed; every `<Claim>` confirmed or removed by the client.

## Steps

1. List the production environment variables the owner must set (SMTP settings and, if used, Turnstile keys) without their values.
2. Verify the production build on `staging`.
3. Run the claim-marker strip script and check no `<Claim>` is left.
4. Produce the exact website DNS records and a step list for the owner or the client; mail records only if the PRD asks.
5. Write the deployment checklist artifact for the owner's hard gate.

## Decision guidance

- The agent never deploys, merges to `main` or changes DNS: the owner does.
