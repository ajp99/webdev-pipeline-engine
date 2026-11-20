// Fonts from the Google Fonts catalog through next/font: downloaded at build time and served from the site's
// own domain, so no visitor request goes to Google (P3-T02). At most two families; the skill
// starter-customization/apply-brand changes them from the design brief.
import { Inter } from 'next/font/google';

export const bodyFont = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-body' });
