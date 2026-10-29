// The four fixed style cards of the design section (P2-T15, D-319). Generic on purpose: they are drawn
// in the repo (apps/web/public/style-cards) and shown by the form. Agent-proposed directions with rendered
// sample pages are a go-live item (G30). The option values match the generic template.
export type StyleCard = { value: string; image: string; blurb: string };

export const STYLE_CARD_QUESTION = 'design_style_cards';

export const STYLE_CARDS: readonly StyleCard[] = [
  {
    value: 'minimal',
    image: '/style-cards/minimal.svg',
    blurb: 'Lots of white space, light type, one calm accent.',
  },
  {
    value: 'bold',
    image: '/style-cards/bold.svg',
    blurb: 'Strong colour blocks, heavy headlines, high contrast.',
  },
  {
    value: 'warm',
    image: '/style-cards/warm.svg',
    blurb: 'Soft shapes, earthy colours, friendly and personal.',
  },
  {
    value: 'corporate',
    image: '/style-cards/corporate.svg',
    blurb: 'Clear grid, restrained blues and greys, trustworthy.',
  },
];

export function styleCardFor(questionId: string, optionValue: string): StyleCard | undefined {
  return questionId === STYLE_CARD_QUESTION
    ? STYLE_CARDS.find((c) => c.value === optionValue)
    : undefined;
}
