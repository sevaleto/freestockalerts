/** Beehiiv posts client against an injected fetch: query shape, 202/404 handling, retry rules. Pure. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPost, getPost, listPosts, listSubscriptions } from "../lib/beehiiv/client";

type Call = { url: string; init?: RequestInit };
const fake = (responses: Array<{ status: number; body?: unknown }>) => {
  const calls: Call[] = [];
  let i = 0;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
};

test("listPosts sends the expands and status asked for, defaulting to stats/confirmed", async () => {
  const f = fake([{ status: 200, body: { data: [{ id: "post_1", title: "t", status: "confirmed", publish_date: 1 }], page: 1, total_pages: 3 } }]);
  const page = await listPosts("pub_x", { fetchImpl: f.fetchImpl, expand: ["free_email_content", "free_web_content"], status: "all", limit: 30 });
  const u = new URL(f.calls[0].url);
  assert.equal(u.pathname, "/v2/publications/pub_x/posts");
  assert.deepEqual(u.searchParams.getAll("expand[]"), ["free_email_content", "free_web_content"]);
  assert.equal(u.searchParams.get("status"), "all");
  assert.equal(u.searchParams.get("limit"), "30");
  assert.equal((f.calls[0].init?.headers as Record<string, string>).Authorization, "Bearer test");
  assert.equal(page.totalPages, 3);

  const g = fake([{ status: 200, body: { data: [] } }]);
  await listPosts("pub_x", { fetchImpl: g.fetchImpl });
  const v = new URL(g.calls[0].url);
  assert.deepEqual(v.searchParams.getAll("expand[]"), ["stats"]);
  assert.equal(v.searchParams.get("status"), "confirmed");
});

test("getPost reports pending on 202, failed on POST_CREATION_FAILED, throws on other errors", async () => {
  const pending = fake([{ status: 202 }]);
  assert.deepEqual(await getPost("pub_x", "post_1", { fetchImpl: pending.fetchImpl }), { post: null, pending: true });
  const failed = fake([{ status: 404, body: { errors: [{ code: "POST_CREATION_FAILED" }] } }]);
  const r = await getPost("pub_x", "post_1", { fetchImpl: failed.fetchImpl });
  assert.equal(r.pending, false);
  assert.match(r.failed ?? "", /POST_CREATION_FAILED/);
  const ok = fake([{ status: 200, body: { data: { id: "post_1", title: "t", status: "draft", publish_date: null } } }]);
  assert.equal((await getPost("pub_x", "post_1", { fetchImpl: ok.fetchImpl, expand: ["free_email_content"] })).post?.id, "post_1");
  assert.match(new URL(ok.calls[0].url).search, /expand%5B%5D=free_email_content/);
  await assert.rejects(getPost("pub_x", "post_1", { fetchImpl: fake([{ status: 403, body: {} }]).fetchImpl }), /Beehiiv 403/);
});

test("createPost posts JSON, returns id + preview, retries 429 but never 5xx", async () => {
  const f = fake([{ status: 429 }, { status: 201, body: { data: { id: "post_new", preview_url: "https://app.beehiiv.com/p/x" } } }]);
  const created = await createPost("pub_x", { title: "T", status: "draft", blocks: [{ type: "paragraph", plaintext: "hi" }] }, { fetchImpl: f.fetchImpl, backoffMs: 0 });
  assert.deepEqual(created, { id: "post_new", previewUrl: "https://app.beehiiv.com/p/x" });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].init?.method, "POST");
  assert.equal(JSON.parse(String(f.calls[1].init?.body)).status, "draft");
  assert.equal((f.calls[1].init?.headers as Record<string, string>)["Content-Type"], "application/json");

  const boom = fake([{ status: 500, body: { errors: [{ message: "oops" }] } }, { status: 201, body: { data: { id: "never" } } }]);
  await assert.rejects(createPost("pub_x", { title: "T", status: "draft", body_content: "<p>x</p>" }, { fetchImpl: boom.fetchImpl, backoffMs: 0 }), /Beehiiv 500/);
  assert.equal(boom.calls.length, 1, "not replayed");

  await assert.rejects(createPost("pub_x", { title: "T", status: "draft" }, { fetchImpl: f.fetchImpl }), /exactly one of/);
  await assert.rejects(createPost("pub_x", { title: "T", status: "draft", blocks: [], body_content: "x" }, { fetchImpl: f.fetchImpl }), /exactly one of/);
});

test("idempotent GETs retry 5xx and give up after four attempts", async () => {
  const f = fake([{ status: 503 }, { status: 503 }, { status: 200, body: { data: [], has_more: false } }]);
  const page = await listSubscriptions("pub_x", { fetchImpl: f.fetchImpl, backoffMs: 0 });
  assert.equal(page.data.length, 0);
  assert.equal(f.calls.length, 3);
  const dead = fake([{ status: 502 }]);
  await assert.rejects(listSubscriptions("pub_x", { fetchImpl: dead.fetchImpl, backoffMs: 0 }), /Beehiiv 502/);
  assert.equal(dead.calls.length, 4);
});
