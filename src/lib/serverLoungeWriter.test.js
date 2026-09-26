import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLoungePost, pickFreeModel, writeLoungePost, writerOrder, buildLoungePrompt } from "./serverLoungeWriter.js";
import { pickLatestModels } from "./openRouterModels.js";

const GOOD = {
  title: "욕실 리모델링 순서, 철거부터 입주까지 7단계",
  meta_description: "욕실 리모델링을 처음 하는 분을 위한 공정 순서와 흔한 실수, 견적 비교 기준을 정리했습니다.",
  content: "**한 줄 답**: 욕실은 방수가 순서를 정합니다.\n\n" + "도입 문장입니다. ".repeat(40) +
    "\n\n## 욕실 공사는 며칠 걸리나요?\n" + "설명 ".repeat(200) +
    "\n\n## 방수는 왜 두 번 하나요?\n" + "설명 ".repeat(200) +
    "\n\n## 체크리스트\n- [ ] 배수 경사\n- [ ] 방수 양생\n\n## 자주 묻는 질문\n### 살면서 할 수 있나요?\n어렵습니다.\n\n여러분 욕실은 어떤가요?",
  tags: ["욕실 리모델링", "#욕실 방수"],
  image_query: "modern bathroom tiles",
};

test("검사 — 좋은 글은 통과, 짧거나 FAQ 없거나 링크 있으면 탈락", () => {
  const ok = validateLoungePost(GOOD);
  assert.ok(ok);
  assert.deepEqual(ok.tags, ["욕실 리모델링", "욕실 방수"]);
  assert.equal(validateLoungePost({ ...GOOD, content: "짧다" }), null);
  assert.equal(validateLoungePost({ ...GOOD, content: GOOD.content.replace("자주 묻는 질문", "질문") }), null);
  assert.equal(validateLoungePost({ ...GOOD, content: GOOD.content + " https://x.y" }), null);
  assert.equal(validateLoungePost({ ...GOOD, title: "짧음" }), null);
});

test("최신 모델 고르기 — 새 모델이 나오면 그쪽으로", () => {
  const list = [
    { id: "anthropic/claude-sonnet-4.5", created: 100 }, { id: "anthropic/claude-sonnet-5", created: 200 },
    { id: "anthropic/claude-sonnet-5:thinking", created: 300 }, { id: "qwen/qwen3-vl-32b-instruct", created: 400 },
    { id: "qwen/qwen3-next-80b-a3b-instruct", created: 350 },
  ];
  const m = pickLatestModels(list);
  assert.equal(m.claude_magazine, "anthropic/claude-sonnet-5");
  assert.equal(m.qwen_translator, "qwen/qwen3-next-80b-a3b-instruct");
});

test("무료 모델 고르기 — 코드·안전·소형 빼고 선호 계열", () => {
  const list = [
    { id: "cohere/north-mini-code:free", created: 9 }, { id: "nvidia/nemotron-3.5-content-safety:free", created: 8 },
    { id: "google/gemma-4-31b-it:free", created: 5 }, { id: "qwen/qwen3.8-27b:free", created: 6 },
  ];
  assert.equal(pickFreeModel(list), "qwen/qwen3.8-27b:free");
});

test("프롬프트 — 지역·독자·검색 규칙이 들어간다", () => {
  const { system, user } = buildLoungePrompt({ topic: "욕실 리모델링 비용", angle: "욕실 하나 얼마?", category: "quote_worry", audience: "consumer", region: "인천 부평구" });
  assert.match(system, /한 줄 답/);
  assert.match(system, /자주 묻는 질문/);
  assert.match(user, /인천 부평구/);
  assert.match(user, /인테리어 수요자/);
});

test("차례 — 유료 실패하면 무료(플랜 B)로, 모두 없으면 null", async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  try {
    delete process.env.OPENROUTER_API_KEY; delete process.env.GEMINI_API_KEY; delete process.env.GROQ_API_KEY; delete process.env.LOUNGE_LLM_ORDER;
    assert.deepEqual(writerOrder(), []);
    assert.equal(await writeLoungePost({ topic: "t" }), null);

    process.env.OPENROUTER_API_KEY = "test-not-real";
    process.env.GROQ_API_KEY = "test-not-real";
    process.env.LOUNGE_LLM_MODEL = "anthropic/claude-sonnet-5";
    process.env.LOUNGE_FREE_MODEL = "qwen/qwen3.8-27b:free";
    assert.deepEqual(writerOrder(), ["openrouter", "openrouter_free", "groq"]);
    const calls = [];
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push(`${String(url).includes("groq") ? "groq" : "or"}:${body.model}`);
      if (String(url).includes("openrouter")) return new Response("busy", { status: 429 });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(GOOD) } }] }), { status: 200 });
    };
    const post = await writeLoungePost({ topic: "욕실", category: "interior" });
    assert.equal(post.provider, "groq");
    assert.equal(post.title, GOOD.title);
    assert.deepEqual(calls, ["or:anthropic/claude-sonnet-5", "or:qwen/qwen3.8-27b:free", "groq:openai/gpt-oss-120b"]);
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
