/**
 * Minimal Beehiiv v2 client: subscriptions (cursor pagination), posts with
 * stats and content (page pagination), and draft creation.
 * Docs: https://developers.beehiiv.com/api-reference/subscriptions/index
 *       https://developers.beehiiv.com/api-reference/posts/index
 *       https://developers.beehiiv.com/api-reference/posts/create
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

/** Options every call accepts; `fetchImpl` and `apiKey` are injected in tests. */
export interface BeehiivRequestOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  /** Backoff base in ms between retries (tests pass 0). */
  backoffMs?: number;
}

export interface ListOptions extends BeehiivRequestOptions {
  cursor?: string | null;
  limit?: number;
  status?: "all" | "active" | "inactive" | "pending" | "validating" | "invalid";
}

const BASE = "https://api.beehiiv.com/v2";

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

function resolveApiKey(opts: BeehiivRequestOptions): string {
  // An injected fetch (tests) needs no real key.
  const apiKey = opts.apiKey ?? process.env.BEEHIIV_API_KEY ?? (opts.fetchImpl ? "test" : "");
  if (!apiKey) throw new Error("BEEHIIV_API_KEY is not set");
  return apiKey;
}

/**
 * One request with up to four attempts. 429 and network errors are always
 * retried; 5xx only when `idempotent` (the default). A POST that creates a
 * post must not be replayed on a 5xx: the server may have accepted it.
 */
async function beehiivFetch(url: string, init: RequestInit, opts: BeehiivRequestOptions & { idempotent?: boolean } = {}): Promise<Response> {
  const apiKey = resolveApiKey(opts);
  const doFetch = opts.fetchImpl ?? fetch;
  const idempotent = opts.idempotent ?? true;
  const backoff = opts.backoffMs ?? 1000;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await doFetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", ...((init.headers as Record<string, string> | undefined) ?? {}) },
      });
      if (res.status === 429 || (idempotent && res.status >= 500)) {
        lastError = new Error(`Beehiiv ${res.status}`);
        if (attempt < 3) await sleep(backoff * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (!idempotent || attempt === 3) break;
      await sleep(backoff * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Beehiiv request failed");
}

async function errorText(res: Response): Promise<string> {
  return (await res.text().catch(() => "")).slice(0, 300);
}

export async function listSubscriptions(publicationId: string, opts: ListOptions = {}): Promise<SubscriptionPage> {
  const url = new URL(`${BASE}/publications/${publicationId}/subscriptions`);
  url.searchParams.set("limit", String(opts.limit ?? 100));
  url.searchParams.set("status", opts.status ?? "all");
  url.searchParams.set("order_by", "created");
  url.searchParams.set("direction", "desc");
  url.searchParams.append("expand[]", "custom_fields");
  url.searchParams.append("expand[]", "stats");
  if (opts.cursor) url.searchParams.set("cursor", opts.cursor);

  const res = await beehiivFetch(url.toString(), {}, opts);
  if (!res.ok) throw new Error(`Beehiiv ${res.status}: ${await errorText(res)}`);
  const body = (await res.json()) as { data?: BeehiivSubscription[]; has_more?: boolean; next_cursor?: string | null };
  return { data: body.data ?? [], hasMore: !!body.has_more, nextCursor: body.next_cursor ?? null };
}

/**
 * Find one subscription by email. Beehiiv's `email` filter is documented as an
 * exact match but has returned unrelated rows on a large list, so the match is
 * confirmed client-side and a few pages are scanned before giving up.
 */
export async function findSubscriptionByEmail(publicationId: string, email: string, opts: BeehiivRequestOptions = {}): Promise<BeehiivSubscription | null> {
  const wanted = email.trim().toLowerCase();
  let cursor: string | null = null;
  for (let page = 0; page < 3; page++) {
    const url = new URL(`${BASE}/publications/${publicationId}/subscriptions`);
    url.searchParams.set("email", wanted);
    url.searchParams.set("limit", "100");
    url.searchParams.set("status", "all");
    url.searchParams.append("expand[]", "stats");
    url.searchParams.append("expand[]", "custom_fields");
    if (cursor) url.searchParams.set("cursor", cursor);
    let res: Response;
    try {
      res = await beehiivFetch(url.toString(), {}, opts);
    } catch {
      throw new Error("Beehiiv no response looking up a subscription");
    }
    if (!res.ok) throw new Error(`Beehiiv ${res.status} looking up a subscription`);
    const body = (await res.json()) as { data?: BeehiivSubscription[]; has_more?: boolean; next_cursor?: string | null };
    const hit = (body.data ?? []).find((s) => s.email?.trim().toLowerCase() === wanted);
    if (hit) return hit;
    if (!body.has_more || !body.next_cursor) return null;
    cursor = body.next_cursor;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Posts: per-issue email numbers, per-link clicks, and (on request) the HTML.
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
  subject_line?: string;
  preview_text?: string;
  status: string;
  /** Unix seconds; null for drafts. */
  publish_date: number | null;
  web_url?: string;
  /** Present when the request expanded `free_email_content` / `free_web_content`. */
  content?: { free?: { email?: string; web?: string; rss?: string }; premium?: { email?: string; web?: string } };
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

export type PostExpand = "stats" | "free_email_content" | "free_web_content" | "free_rss_content" | "premium_email_content" | "premium_web_content";

export interface ListPostsOptions extends BeehiivRequestOptions {
  page?: number;
  limit?: number;
  /** Defaults to `["stats"]`, what the subscriber sync reads. */
  expand?: PostExpand[];
  status?: "confirmed" | "draft" | "archived" | "all";
}

export async function listPosts(publicationId: string, opts: ListPostsOptions = {}): Promise<PostsPage> {
  const url = new URL(`${BASE}/publications/${publicationId}/posts`);
  url.searchParams.set("limit", String(opts.limit ?? 50));
  url.searchParams.set("page", String(opts.page ?? 1));
  url.searchParams.set("status", opts.status ?? "confirmed");
  url.searchParams.set("order_by", "publish_date");
  url.searchParams.set("direction", "desc");
  for (const e of opts.expand ?? ["stats"]) url.searchParams.append("expand[]", e);
  const res = await beehiivFetch(url.toString(), {}, opts);
  if (!res.ok) throw new Error(`Beehiiv ${res.status}: ${await errorText(res)}`);
  const body = (await res.json()) as { data?: BeehiivPost[]; page?: number; total_pages?: number };
  return { data: body.data ?? [], page: body.page ?? opts.page ?? 1, totalPages: body.total_pages ?? 1 };
}

export interface GetPostResult {
  post: BeehiivPost | null;
  /** 202: the post is still being created in the background. */
  pending: boolean;
  /** Set when Beehiiv reports POST_CREATION_FAILED (404 with that code). */
  failed?: string;
}

export async function getPost(publicationId: string, postId: string, opts: BeehiivRequestOptions & { expand?: PostExpand[] } = {}): Promise<GetPostResult> {
  const url = new URL(`${BASE}/publications/${publicationId}/posts/${postId}`);
  for (const e of opts.expand ?? []) url.searchParams.append("expand[]", e);
  const res = await beehiivFetch(url.toString(), {}, opts);
  if (res.status === 202) return { post: null, pending: true };
  if (res.status === 404) {
    const text = await errorText(res);
    if (/POST_CREATION_FAILED/i.test(text)) return { post: null, pending: false, failed: text };
    throw new Error(`Beehiiv 404: ${text}`);
  }
  if (!res.ok) throw new Error(`Beehiiv ${res.status}: ${await errorText(res)}`);
  const body = (await res.json()) as { data?: BeehiivPost };
  return { post: body.data ?? null, pending: false };
}

// ---------------------------------------------------------------------------
// Create post (Max/Enterprise plans). Field names follow the API reference.
// ---------------------------------------------------------------------------

export interface BeehiivFormattedText {
  text: string;
  styling?: ("bold" | "italic" | "underline" | "strikethrough")[];
  text_color?: string;
  link?: { href: string; target?: string };
}

export interface BeehiivVisibility {
  show_on_web?: boolean;
  show_on_email?: boolean;
}

export type BeehiivBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text?: string; formattedText?: BeehiivFormattedText[]; textAlignment?: "left" | "center" | "right"; anchorHeader?: boolean; anchorIncludeInToc?: boolean; visibility_settings?: BeehiivVisibility }
  | { type: "paragraph"; plaintext?: string; formattedText?: BeehiivFormattedText[]; textAlignment?: "left" | "center" | "right"; visibility_settings?: BeehiivVisibility }
  | { type: "button"; href: string; text: string; alignment?: "left" | "center" | "right"; size?: "small" | "normal" | "large"; target?: string; visibility_settings?: BeehiivVisibility }
  | { type: "html"; html: string; visibility_settings?: BeehiivVisibility };

export interface CreatePostBody {
  title: string;
  subtitle?: string;
  /** Always pass it: the API default is documented as `draft` but was `confirmed` (publish now) before Aug 2026. */
  status: "draft" | "confirmed";
  /** Either `blocks` or `body_content`, never both. */
  blocks?: BeehiivBlock[];
  body_content?: string;
  email_settings?: {
    email_subject_line?: string;
    email_preview_text?: string;
    display_title_in_email?: boolean;
    display_subtitle_in_email?: boolean;
    display_byline_in_email?: boolean;
  };
  web_settings?: {
    hide_from_feed?: boolean;
    slug?: string;
    display_title_on_web?: boolean;
    display_subtitle_on_web?: boolean;
    display_thumbnail_on_web?: boolean;
  };
  content_tags?: string[];
  thumbnail_image_url?: string;
}

export interface CreatedPost {
  id: string;
  /** Email preview in the Beehiiv app; needs a signed-in Beehiiv session. */
  previewUrl: string | null;
}

/** Create a post. Not retried on 5xx: the request may have been accepted. */
export async function createPost(publicationId: string, body: CreatePostBody, opts: BeehiivRequestOptions = {}): Promise<CreatedPost> {
  if ((body.blocks && body.body_content) || (!body.blocks && !body.body_content)) throw new Error("createPost needs exactly one of blocks or body_content");
  const res = await beehiivFetch(
    `${BASE}/publications/${publicationId}/posts`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    { ...opts, idempotent: false }
  );
  if (!res.ok) throw new Error(`Beehiiv ${res.status} creating a post: ${await errorText(res)}`);
  const payload = (await res.json()) as { data?: { id?: string; preview_url?: string } };
  const id = payload.data?.id;
  if (!id) throw new Error("Beehiiv created a post but returned no id");
  return { id, previewUrl: payload.data?.preview_url ?? null };
}

/** The post's page in the Beehiiv app (overview with an Edit button). The app drops the `post_` prefix. */
export const beehiivEditUrl = (postId: string) => `https://app.beehiiv.com/posts/${postId.replace(/^post_/, "")}`;
