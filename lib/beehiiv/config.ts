/** Beehiiv publications we sync. Ids are not secrets; the API key is BEEHIIV_API_KEY. */
export type NewsletterKey = "fsa" | "si";

export interface BeehiivPublication {
  key: NewsletterKey;
  name: string;
  id: string;
  /** Value of `Subscriber.attributionSource` and `EmailAdClick.channel` for this list. */
  source: "beehiiv_fsa" | "beehiiv_si";
}

/** Every publication the code knows about. */
export const ALL_PUBLICATIONS: BeehiivPublication[] = [
  { key: "fsa", name: "FreeStockAlerts.AI", id: process.env.BEEHIIV_PUB_FSA ?? "pub_a4d0f0b3-1d9b-434b-82cd-57a61db3fa79", source: "beehiiv_fsa" },
  { key: "si", name: "The Smart Investor", id: process.env.BEEHIIV_PUB_SI ?? "pub_3c150030-1e5e-44be-8c89-b61bea6f1a20", source: "beehiiv_si" },
];

/**
 * Publications the tracked subscribers are looked up in. Decision 2026-09-06:
 * only people who signed up on the FreeStockAlerts website are tracked, but a
 * click by one of them in either newsletter counts.
 */
export const BEEHIIV_PUBLICATIONS: BeehiivPublication[] = ALL_PUBLICATIONS;

export const publicationByKey = (key: string) => ALL_PUBLICATIONS.find((p) => p.key === key) ?? null;

export const beehiivConfigured = () => !!process.env.BEEHIIV_API_KEY;
