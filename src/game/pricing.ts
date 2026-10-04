// Two ways for a client to pay for a site:
//   buyout   pay the full price once and the site is theirs
//   retainer pay a small monthly fee for as long as they keep the site, which
//            covers hosting and ongoing maintenance
// The monthly fee is always a tenth of the full price: $1,000 or $100 a month.

export type PricePlan = 'buyout' | 'retainer';

/** What you offer in a quote. "either" lets the client pick. */
export type QuotePlan = PricePlan | 'either';

export const RETAINER_DIVISOR = 10;
/** Game days between monthly payments. */
export const RETAINER_DAYS = 30;

/** The monthly fee for a site with this full price. */
export function retainerFee(price: number): number {
  return Math.max(1, Math.round(price / RETAINER_DIVISOR));
}

const usd = (n: number) => `$${n.toLocaleString()}`;

/** An amount in the way the client pays it: "$1,000" or "$100 a month". */
export function priceText(plan: PricePlan | undefined, price: number): string {
  return plan === 'retainer' ? `${usd(retainerFee(price))} a month` : usd(price);
}

/** Short label for a plan. */
export const PLAN_NAMES: Record<QuotePlan, string> = {
  buyout: 'One-time buyout',
  retainer: 'Monthly retainer',
  either: 'Client picks',
};
