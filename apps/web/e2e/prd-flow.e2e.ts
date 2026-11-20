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
  await page.locator('input[name=name]').fill(`Acme Dental ${Date.now()}`);
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
  await expect(page.getByText('Site map and pages')).toBeVisible();
  await expect(page.getByText('Gaps and conflicts (owner only)')).toBeVisible();
  await expect(page.getByText('No budget given')).toBeVisible();

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
});
