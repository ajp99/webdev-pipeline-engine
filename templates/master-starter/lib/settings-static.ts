// The settings bundled into server code that runs per request (the contact route), checked like the rest.
import raw from '../content/settings.json';
import { ContentError, describe, settingsSchema, type Settings } from './schemas';

const r = settingsSchema.safeParse(raw);
if (!r.success) throw new ContentError(describe('content/settings.json', r.error));
export const settings: Settings = r.data;
