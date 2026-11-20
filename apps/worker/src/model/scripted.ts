// A scripted model for the end-to-end test (P2-T14): it answers by the schema it is asked for, with no network
// and no key. modelFromEnv allows it only when WPE_E2E=1, so a real worker never runs on it by mistake.
import type { JsonRequest, JsonResponse, ModelClient } from './types';

const REVIEW = {
  summary: 'The intake is complete enough to write the PRD (scripted).',
  gaps: [],
  followups: [],
};

const PRD = {
  sections: {
    business:
      'Acme Dental is a family dental practice that wants more new patients to book online (scripted).',
    site_map: '- Home\n- Services\n- Contact\n- Privacy policy\n- Cookie notice',
    features: '- Contact form (Must), honeypot spam protection\n- Online booking link (Should)',
    content: 'The client supplies photos and opening hours; the agency drafts the page texts.',
    brand: 'Calm blues and white, friendly tone (proposal, to confirm).',
    non_functional: 'Lighthouse 80+, basic SEO, responsive, accessibility basics.',
  },
  spam_protection: 'honeypot',
  change_summary: '',
  gaps: [{ issue: 'No budget given', resolution: 'Kept to five pages' }],
  conflicts: [],
};

const PLAN = {
  rounds: [
    {
      title: 'Brand and main pages',
      scope: ['Home', 'Services'],
      skills: [
        'starter-customization/apply-brand',
        'industry-copy/write-page-copy',
        'accessibility-basics/page-checks',
      ],
      depends_on: [],
      hard: false,
      token_budget: 300000,
    },
    {
      title: 'Contact and legal',
      scope: ['Contact', 'Privacy policy', 'Cookie notice'],
      skills: ['smtp-contact-form/configure-form', 'seo/on-page-basics'],
      depends_on: [1],
      hard: false,
      token_budget: 200000,
    },
  ],
  design_brief: {
    palette: 'Calm blues and white (scripted)',
    fonts: 'Inter',
    layout: 'Mobile first, airy',
    references: 'None given',
  },
  rationale: {
    rounds: 'Few pages, no blog: 2 rounds.',
    skills: 'From the PRD.',
    budget: 'Small site.',
    design: 'From the brand section.',
  },
};

export function scriptedModel(): ModelClient {
  return {
    name: 'scripted:e2e',
    async generateJson(req: JsonRequest): Promise<JsonResponse> {
      const props = (req.schema as { properties?: Record<string, unknown> }).properties ?? {};
      if ('followups' in props) return { text: JSON.stringify(REVIEW), tokens: 10 };
      if ('sections' in props) {
        const revising = req.user.includes('<previous_prd>');
        return {
          text: JSON.stringify({
            ...PRD,
            change_summary: revising ? 'Revised from the owner notes (scripted).' : '',
          }),
          tokens: 20,
        };
      }
      if ('rounds' in props) return { text: JSON.stringify(PLAN), tokens: 30 };
      throw new Error('the scripted model has no answer for this schema');
    },
  };
}
