import { compileMDX } from 'next-mdx-remote/rsc';
import { Claim } from './Claim';
import { Placeholder } from './Placeholder';
import { BusinessName, ContactEmail } from './SettingsText';
import { CallToAction } from './sections/CallToAction';
import { ContactSection } from './sections/ContactSection';
import { Faq } from './sections/Faq';
import { Features } from './sections/Features';
import { Hero } from './sections/Hero';
import { Testimonials } from './sections/Testimonials';

/** The components a page or post may use (documented for the client's editor guide). */
export const MDX_COMPONENTS = {
  Hero,
  Features,
  Testimonials,
  Faq,
  CallToAction,
  ContactSection,
  Claim,
  Placeholder,
  BusinessName,
  ContactEmail,
};

export async function Mdx({ source }: { source: string }) {
  // Content files are the site's own source, reviewed like code, and section props are plain data
  // (items={[...]}), so expressions are allowed; eval, Function, process and imports stay blocked.
  const { content } = await compileMDX({
    source,
    components: MDX_COMPONENTS,
    options: { parseFrontmatter: false, blockJS: false, blockDangerousJS: true },
  });
  return content;
}
