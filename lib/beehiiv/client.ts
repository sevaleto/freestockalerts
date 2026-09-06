/**
 * Minimal Beehiiv v2 client: list subscriptions with cursor pagination.
 * Docs: https://developers.beehiiv.com/api-reference/subscriptions/index
 */
export interface BeehiivSubscription {
  id: string;
  email: string;
  status: string;
  /** Unix seconds. */
  created: number;
  utm_source?: string;
  utm_medium?: string;
  utm_channel?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referring_site?: string;
  custom_fields?: { name: string; value: unknown }[];
  /** Lifetime engagement for this subscription (expand[]=stats). */
  stats?: { total_sent?: number; total_received?: number; total_unique_opened?: number; total_clicked?: number; total_unique_clicked?: number };
}

export interface SubscriptionPage {
  data: BeehiivSubscription[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ListOptions {
  cursor?: string | null;
  limit?: number;
  status?: "all" | "active" | "inactive" | "pending" | "validating" | "invalid";
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
  apiKey?: string;
}

const BASE = "https://api.beehiiv.com/v2";

export async function listSubscriptions(publicationId: string, opts: ListOptions = {}): Promise<SubscriptionPage> {
  // An injected fetch (tests) needs no real key.
  const apiKey = opts.apiKey ?? process.env.BEEHIIV_API_KEY ?? (opts.fetchImpl ? "test" : "");
  if (!apiKey) throw new Error("BEEHIIV_API_KEY is not set");
  const url = new URL(`${BASE}/publications/${publicationId}/subscriptions`);
  url.searchParams.set("limit", String(opts.limit ?? 100));
  url.searchParams.set("status", opts.status ?? "all");
  url.searchParams.set("order_by", "created");
  url.searchParams.set("direction", "desc");
  url.searchParams.append("expand[]", "custom_fields");
  url.searchParams.append("expand[]", "stats");
  if (opts.cursor) url.searchParams.set("cursor", opts.cursor);

  const doFetch = opts.fetchImpl ?? fetch;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Beehiiv ${res.status}`);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Beehiiv ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { data?: BeehiivSubscription[]; has_more?: boolean; next_cursor?: string | null };
      return { data: body.data ?? [], hasMore: !!body.has_more, nextCursor: body.next_cursor ?? null };
    } catch (err) {
      lastError = err;
      if (attempt === 3) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Beehiiv request failed");
}

/**
 * Find one subscription by email. Beehiiv's `email` filter is documented as an
 * exact match but has returned unrelated rows on a large list, so the match is
 * confirmed client-side and a few pages are scanned before giving up.
 */
export async function findSubscriptionByEmail(publicationId: string, email: string, opts: { fetchImpl?: typeof fetch; apiKey?: string } = {}): Promise<BeehiivSubscription | null> {
  const apiKey = opts.apiKey ?? process.env.BEEHIIV_API_KEY ?? (opts.fetchImpl ? "test" : "");
  if (!apiKey) throw new Error("BEEHIIV_API_KEY is not set");
  const wanted = email.trim().toLowerCase();
  const doFetch = opts.fetchImpl ?? fetch;
  let cursor: string | null = null;
  for (let page = 0; page < 3; page++) {
    const url = new URL(`${BASE}/publications/${publicationId}/subscriptions`);
    url.searchParams.set("email", wanted);
    url.searchParams.set("limit", "100");
    url.searchParams.set("status", "all");
    url.searchParams.append("expand[]", "stats");
    url.searchParams.append("expand[]", "custom_fields");
    if (cursor) url.searchParams.set("cursor", cursor);
    let res: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
      if (res.status !== 429 && res.status < 500) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
    if (!res || !res.ok) throw new Error(`Beehiiv ${res?.status ?? "no response"} looking up a subscription`);
    const body = (await res.json()) as { data?: BeehiivSubscription[]; has_more?: boolean; next_cursor?: string | null };
    const hit = (body.data ?? []).find((s) => s.email?.trim().toLowerCase() === wanted);
    if (hit) return hit;
    if (!body.has_more || !body.next_cursor) return null;
    cursor = body.next_cursor;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Posts with stats: per-issue email numbers and per-link clicks.
// Docs: https://developers.beehiiv.com/api-reference/posts/index (page-based).
// ---------------------------------------------------------------------------

export interface BeehiivLinkStat {
  url: string;
  base_url: string;
  total_clicks?: number;
  total_unique_clicks?: number;
  email?: { clicks?: number; unique_clicks?: number; verified_clicks?: number; unique_verified_clicks?: number };
  web?: { clicks?: number; unique_clicks?: number };
}

export interface BeehiivPost {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
  /** Unix seconds; null for drafts. */
  publish_date: number | null;
  web_url?: string;
  stats?: {
    email?: { recipients?: number; delivered?: number; opens?: number; unique_opens?: number; clicks?: number; unique_clicks?: number; verified_clicks?: number; unique_verified_clicks?: number; unsubscribes?: number };
    web?: { views?: number; clicks?: number };
    clicks?: BeehiivLinkStat[];
  };
}

export interface PostsPage {
  data: BeehiivPost[];
  page: number;
  totalPages: number;
}

export async function listPosts(publicationId: string, opts: { page?: number; limit?: number; fetchImpl?: typeof fetch; apiKey?: string } = {}): Promise<PostsPage> {
  const apiKey = opts.apiKey ?? process.env.BEEHIIV_API_KEY ?? (opts.fetchImpl ? "test" : "");
  if (!apiKey) throw new Error("BEEHIIV_API_KEY is not set");
  const url = new URL(`${BASE}/publications/${publicationId}/posts`);
  url.searchParams.set("limit", String(opts.limit ?? 50));
  url.searchParams.set("page", String(opts.page ?? 1));
  url.searchParams.set("status", "confirmed");
  url.searchParams.set("order_by", "publish_date");
  url.searchParams.set("direction", "desc");
  url.searchParams.append("expand[]", "stats");
  const doFetch = opts.fetchImpl ?? fetch;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Beehiiv ${res.status}`);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Beehiiv ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { data?: BeehiivPost[]; page?: number; total_pages?: number };
      return { data: body.data ?? [], page: body.page ?? opts.page ?? 1, totalPages: body.total_pages ?? 1 };
    } catch (err) {
      lastError = err;
      if (attempt === 3) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Beehiiv request failed");
}
