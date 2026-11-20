import { describe, expect, it } from 'vitest';
import { DISPOSITION, marksFromForm, planFromForm, skillsUsed } from './plan-edit';

const form = (over: Record<string, string> = {}) => ({
  rounds: '2',
  round_1_title: 'Core',
  round_1_scope: 'Home, Services\nAbout',
  round_1_skills: 'seo/on-page-basics, seo/on-page-basics',
  round_1_depends_on: '',
  round_1_budget: '300,000',
  round_2_title: 'Contact',
  round_2_scope: 'Contact, Privacy policy, Cookie notice',
  round_2_skills: 'smtp-contact-form/configure-form',
  round_2_depends_on: '1',
  round_2_hard: 'on',
  round_2_budget: '200000',
  palette: 'Teal',
  fonts: 'Inter',
  layout: 'Airy',
  references: 'None',
  why_rounds: 'r',
  why_skills: 's',
  why_budget: 'b',
  why_design: 'd',
  ...over,
});

describe('planFromForm', () => {
  it('builds the plan, splits lists, removes repeated skills, reads hard flags and computes the total', () => {
    const r = planFromForm(form());
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.rounds[0]).toEqual({
      number: 1,
      title: 'Core',
      scope: ['Home', 'Services', 'About'],
      skills: ['seo/on-page-basics'],
      depends_on: [],
      hard: false,
      token_budget: 300_000,
    });
    expect(r.plan.rounds[1]!.hard).toBe(true);
    expect(r.plan.total_token_budget).toBe(500_000);
  });
  it('says what is wrong', () => {
    expect(planFromForm(form({ rounds: '0' }))).toEqual({
      ok: false,
      error: 'A plan has 1 to 8 rounds.',
    });
    expect(planFromForm(form({ round_2_depends_on: '2' }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('earlier rounds'),
    });
    expect(planFromForm(form({ round_1_budget: '12' }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('token budget'),
    });
    expect(planFromForm(form({ why_design: ' ' }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('rationale.design'),
    });
    expect(planFromForm(form({ round_1_skills: 'SEO' }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('area/name'),
    });
  });
});

describe('skill marks (P3-T08)', () => {
  it('lists the skills a plan or a prototype used', () => {
    const r = planFromForm(form());
    if (!r.ok) throw new Error(r.error);
    expect(skillsUsed('plan', r.plan)).toEqual([
      'seo/on-page-basics',
      'smtp-contact-form/configure-form',
    ]);
    expect(skillsUsed('prototype', { skills: ['a/b', 3] })).toEqual(['a/b']);
    expect(skillsUsed('prd', {})).toEqual([]);
  });
  it('keeps only good and bad marks; unmarked skills do not count', () => {
    expect(
      marksFromForm(
        { 'mark_a/b': 'good', 'mark_c/d': '', 'mark_e/f': 'bad', 'mark_x/y': 'great' },
        ['a/b', 'c/d', 'e/f', 'x/y'],
      ),
    ).toEqual([
      { skill: 'a/b', mark: 'good' },
      { skill: 'e/f', mark: 'bad' },
    ]);
  });
  it('maps each note action to its recorded disposition (P3-T06)', () => {
    expect(DISPOSITION).toEqual({
      forward: 'forwarded',
      change_request: 'change_request',
      dismiss: 'ignored',
    });
  });
});
