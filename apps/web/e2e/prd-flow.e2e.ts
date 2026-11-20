// P2-T14: the 2b flow in a browser, from a new project to the client's PRD sign-off, with the models scripted.
// The worker runs alongside on MODEL_PROVIDER=scripted (WPE_E2E=1); scripts/e2e.sh starts everything.
import { expect, test, type Locator, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner@example.test';
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'e2e-owner-password';

/** Reloads the page until the locator shows: the worker polls every few seconds. */
async function waitFor(page: Page, target: (p: Page) => Locator, timeoutMs = 150_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (await target(page).first().isVisible()) return;
    if (Date.now() > end) await expect(target(page).first()).toBeVisible({ timeout: 1 });
    await page.waitForTimeout(2000);
    await page.reload();
  }
}

test('from a new project to the client signing off the PRD', async ({ page }) => {
  // Sign in as the owner.
  await page.goto('/login');
  await page.locator('input[name=email]').fill(EMAIL);
  await page.locator('input[name=password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

  // Create the project from the generic template.
  await page.goto('/owner/projects/new');
  const projectName = `Acme Dental ${Date.now()}`;
  await page.locator('input[name=name]').fill(projectName);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/owner\/projects\/[0-9a-f-]+\/intake/);
  const intakeUrl = page.url().split('?')[0]!;
  const projectUrl = intakeUrl.replace(/\/intake$/, '');

  // Enter the client's answers, section by section (only the required ones).
  const save = () => page.getByRole('button', { name: 'Save this section' }).click();
  await page.goto(`${intakeUrl}?section=business`);
  await page.locator('[name=q_business_name]').fill('Acme Dental');
  await page.locator('[name=q_what_you_do]').fill('A family dental practice for the whole town.');
  await page.locator('[name=q_contact_email]').fill('hello@acme-dental.test');
  await save();
  await page.goto(`${intakeUrl}?section=goals`);
  await page.locator('[name=q_site_goal][value=bookings]').check();
  await page.locator('[name=q_main_audience]').fill('Local families looking for a dentist.');
  await save();
  await page.goto(`${intakeUrl}?section=content`);
  await page.locator('[name=q_pages_wanted][value=home]').check();
  await page.locator('[name=q_copy_status][value=need_help]').check();
  await save();
  await page.goto(`${intakeUrl}?section=design`);
  await page.locator('[name=q_design_style_cards][value=minimal]').check();
  await page.locator('[name=q_layout_density][value=balanced]').check();
  await save();

  // Submit the round, run the review (scripted: no follow-ups), and accept the intake.
  await page.goto(intakeUrl);
  await expect(page.getByText('All required answers are in.')).toBeVisible();
  await page.getByRole('button', { name: 'Submit round' }).click();
  await page.getByRole('button', { name: 'Run review' }).click();
  const gate = (p: Page) =>
    p.getByRole('region', { name: 'Gate' }).getByRole('button', { name: 'Accept' });
  await waitFor(page, (p) => gate(p).and(p.locator(':enabled')));
  await gate(page).click();

  // Accepting the intake queues the requirements agent; its PRD shows on the PRD page.
  await page.goto(`${projectUrl}/prd`);
  await waitFor(page, (p) => p.getByRole('heading', { name: /^Draft 1/ }));
  await expect(page.getByRole('heading', { name: 'Site map and pages' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Gaps and conflicts (owner only)' }),
  ).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'No budget given' })).toBeVisible();

  // The owner edits a section; the summary is prefilled with the changed section and the owner keeps it.
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.locator('[name=section_brand]').fill('Calm blues and white, warm and friendly tone.');
  await expect(page.locator('[name=change_summary]')).toHaveValue('Changed: Brand inputs.');
  await page.getByRole('button', { name: 'Save as a new version' }).click();
  await expect(page.getByText('Saved as a new version.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Draft 2/ })).toBeVisible();

  // The diff shows the brand change and nothing else.
  await page.getByRole('link', { name: 'Compare with Draft 1' }).first().click();
  await expect(page.getByText('+ Calm blues and white, warm and friendly tone.')).toBeVisible();
  await expect(page.getByText('(unchanged)')).toHaveCount(6);

  // The client asks for a change on draft 2; the owner records it (it goes to the owner only).
  await page.goto(`${projectUrl}/prd`);
  await page.locator('textarea[name=body]').fill('Please mention Saturday opening hours.');
  await page.getByRole('button', { name: 'Record request for changes' }).click();
  await expect(page.getByText('Please mention Saturday opening hours.')).toBeVisible();

  // Sign-off needs the channel note; then the newest version is the signed v1.0.
  await page.locator('input[name=note]').fill('Email from the client, 20 November');
  await page.getByRole('button', { name: 'Record sign-off' }).click();
  await expect(page.getByText('Sign-off recorded.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^v1\.0/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);

  // After the sign-off: Advance (the owner's step), then a change request through to its PRD version v1.1.
  await page.goto('/owner/queue');
  const advance = page
    .getByRole('listitem')
    .filter({ hasText: projectName })
    .getByRole('button', { name: 'Advance to plan' });
  await advance.click();
  await expect(advance).toHaveCount(0, { timeout: 30_000 });
  await page.goto(`${projectUrl}/changes`);
  await page.locator('textarea[name=description]').fill('Add a gallery page with practice photos.');
  await page.locator('input[name=pages]').fill('Gallery');
  await page.getByRole('button', { name: 'Record' }).click();
  await expect(page.getByText('Change request recorded.')).toBeVisible();
  await page.locator('textarea[name=impactNote]').fill('One more page; about half a day.');
  await page.locator('select[name=decision]').selectOption('accept_current_round');
  await page.getByRole('button', { name: 'Decide' }).click();
  await expect(page.getByText('Accepted. Now write the PRD version for it.')).toBeVisible();
  await page.getByRole('link', { name: 'Write the PRD version for this change' }).click();
  await page
    .locator('[name=section_site_map]')
    .fill('- Home\n- Gallery\n- Contact\n- Privacy policy\n- Cookie notice');
  await expect(page.locator('[name=change_summary]')).toHaveValue('Changed: Site map and pages.');
  await page.locator('[name=change_summary]').fill('Added a Gallery page, as agreed.');
  await page.getByRole('button', { name: 'Save as a new version' }).click();
  await expect(page.getByText('Saved as a new version.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^v1\.1/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Send v1.1 to the client' })).toBeVisible();

  // Phase 3 (P3-T11): from the signed PRD to an approved prototype. The plan and the prototype agent are
  // scripted; the prototype's build, commit, preview and screenshots are real.
  const card = (gate: string) =>
    page
      .getByRole('listitem')
      .filter({ hasText: projectName })
      .filter({ hasText: `${gate} gate` });
  // Accept on the queue is a server action: wait until the card has left the queue before going on, or a
  // navigation straight after the click can cancel the action before it reaches the database.
  const accept = async (gate: string) => {
    await card(gate).getByRole('button', { name: 'Accept' }).click();
    await expect(card(gate)).toHaveCount(0, { timeout: 30_000 });
  };
  await page.goto(`${projectUrl}/stage`);
  await page.getByRole('button', { name: 'Run plan' }).click();
  await waitFor(page, (p) => p.getByRole('link', { name: 'plan v1' }));
  await page.getByRole('link', { name: 'plan v1' }).click();
  await expect(page.getByRole('heading', { name: 'Rounds (2; 0 hard)' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit the plan' })).toBeVisible();
  // Optional skill marks (P3-T08).
  await page.locator('select[name="mark_seo/on-page-basics"]').selectOption('good');
  await page.getByRole('button', { name: 'Save marks' }).click();
  await expect(page.getByText('Skill marks saved (1 marked).')).toBeVisible();
  // The owner accepts the plan; that queues the prototype run.
  await page.goto('/owner/queue');
  await accept('soft');
  await page.goto(`${projectUrl}/stage`);
  await waitFor(page, (p) => p.getByRole('link', { name: 'prototype v1' }), 480_000);
  await page.getByRole('link', { name: 'prototype v1' }).click();
  await expect(page.getByRole('heading', { name: 'Screenshots for the client' })).toBeVisible();
  await expect(page.getByAltText("Desktop screenshot of the prototype's main page")).toBeVisible();
  await expect(page.getByAltText("Mobile screenshot of the prototype's main page")).toBeVisible();
  await expect(page.getByText('Claims for the client to confirm: 1')).toBeVisible();
  // The client's reply is a note the owner handles (P3-T06): here, dismissed.
  await page.locator('textarea[name=body]').fill('Looks great, maybe a warmer photo later.');
  await page.getByRole('button', { name: 'Record the note' }).click();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText('Handled: ignored.')).toBeVisible();
  // Two approvals: the owner first, then the client's, recorded with the channel (P3-T05).
  await page.goto('/owner/queue');
  await accept('soft');
  await card('client')
    .locator('textarea[name=note]')
    .fill('Client approved the screenshots by email, 20 November');
  await accept('client');
  await page.goto(`${projectUrl}/stage`);
  await expect(page.getByText(/build rounds stage/)).toBeVisible();
});
