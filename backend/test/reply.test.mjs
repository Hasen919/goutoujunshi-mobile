import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/reply.mjs";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const code = "a-safe-personal-code-123456789";
const input = {
  incoming: "最近有点忙，过段时间再说吧",
  context: "上周约过一次",
  relation: "暧昧中",
  goal: "理解",
  tone: "稳妥",
  provider: "deepseek",
};
const advice = {
  draft: "你先忙，等方便时再联系我就好。",
  alternate: "理解，那我们先各忙各的。",
  fact: "对方说最近忙，暂未给具体时间。",
  unknown: "仅凭这句话无法确定真实意愿。",
  next: "观察是否主动提出具体时间。",
  badge: "保持观察",
  stop: false,
};

function request(body = input, options = {}) {
  return new Request("https://private.example/api/reply", {
    method: options.method || "POST",
    headers: {
      Origin: options.origin || "https://hasen919.github.io",
      "Content-Type": "application/json",
      "X-App-Access-Code": options.code ?? code,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.APP_ACCESS_CODE = code;
  process.env.APP_ALLOWED_ORIGIN = "https://hasen919.github.io";
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test("rejects unknown origin and invalid access code", async () => {
  assert.equal((await handler.fetch(request(input, { origin: "https://other.example" }))).status, 403);
  assert.equal((await handler.fetch(request(input, { code: "wrong" }))).status, 401);
});

test("validates request body before calling a provider", async () => {
  globalThis.fetch = () => { throw new Error("should not call provider"); };
  assert.equal((await handler.fetch(request({ ...input, incoming: "" }))).status, 400);
  assert.equal((await handler.fetch(request({ ...input, provider: "unknown" }))).status, 400);
});

test("CORS preflight exposes only the configured origin", async () => {
  const response = await handler.fetch(new Request("https://private.example/api/reply", {
    method: "OPTIONS", headers: { Origin: "https://hasen919.github.io" },
  }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://hasen919.github.io");
});

test("DeepSeek request uses chat completions and JSON mode", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-deepseek-key");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "deepseek-v4-pro");
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.match(body.messages[1].content, /上周约过一次/);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(advice) } }] });
  };
  const response = await handler.fetch(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.draft, advice.draft);
});

test("OpenAI request uses Responses API, structured output and no storage", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.headers.Authorization, "Bearer test-openai-key");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "gpt-6-sol");
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, "json_schema");
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(advice) }] }] });
  };
  const response = await handler.fetch(request({ ...input, provider: "openai" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, "openai");
});

test("a missing provider key does not silently switch to a template", async () => {
  delete process.env.DEEPSEEK_API_KEY;
  const response = await handler.fetch(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "provider_not_configured");
});
