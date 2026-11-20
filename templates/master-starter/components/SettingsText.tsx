import { getSettings } from '@/lib/content';

/** Values from content/settings.json for use in page text (the legal templates use these). */
export const BusinessName = () => <>{getSettings().businessName}</>;
export const ContactEmail = () => {
  const e = getSettings().contact.email;
  return e ? <a href={`mailto:${e}`}>{e}</a> : <>the contact details on this site</>;
};
