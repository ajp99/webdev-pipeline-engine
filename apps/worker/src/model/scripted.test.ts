import { describe, expect, it } from 'vitest';
import {
  parseRequirementsReply,
  REQUIREMENTS_JSON_SCHEMA,
  REVIEW_JSON_SCHEMA,
  reviewReplySchema,
} from '@wpe/shared';
import { scriptedModel } from './scripted';

describe('scriptedModel (end-to-end test only)', () => {
  it('answers the intake review and the requirements schemas with replies that pass their checks', async () => {
    const m = scriptedModel();
    const review = await m.generateJson({ system: '', user: '', schema: REVIEW_JSON_SCHEMA });
    expect(reviewReplySchema.safeParse(JSON.parse(review.text)).success).toBe(true);
    const first = await m.generateJson({ system: '', user: '', schema: REQUIREMENTS_JSON_SCHEMA });
    expect(
      parseRequirementsReply(JSON.parse(first.text), { hasPrevious: false, ownerNotes: [] }).ok,
    ).toBe(true);
    const again = await m.generateJson({
      system: '',
      user: '<previous_prd>',
      schema: REQUIREMENTS_JSON_SCHEMA,
    });
    expect(
      parseRequirementsReply(JSON.parse(again.text), { hasPrevious: true, ownerNotes: [] }).ok,
    ).toBe(true);
  });
  it('refuses a schema it does not know', async () => {
    await expect(
      scriptedModel().generateJson({ system: '', user: '', schema: {} }),
    ).rejects.toThrow(/no answer/);
  });
});
