#!/usr/bin/env node
// 네이버 블로그 전체 글의 제목/본문을 추출해 JSON으로 저장한다.
// 사용법: node scripts/naver-blog-crawler.mjs <blogId> [outputFile]
// 예시:   node scripts/naver-blog-crawler.mjs blueblueberrry naver-posts.json

import { writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

const REQUEST_DELAY_MS = 400;
const MAX_LIST_PAGES = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPostList(blogId) {
  const posts = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const url = `https://blog.naver.com/PostTitleListAsync.naver?blogId=${encodeURIComponent(
      blogId
    )}&currentPage=${page}&categoryNo=0&countPerPage=30`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      throw new Error(`글 목록 조회 실패 (page ${page}): HTTP ${res.status}`);
    }
    const text = await res.text();
    const data = JSON.parse(text);
    const list = data.postList ?? [];
    if (list.length === 0) break;

    for (const post of list) {
      posts.push({ logNo: String(post.logNo), title: post.title ?? "" });
    }
    if (data.isEnd) break;
    await sleep(REQUEST_DELAY_MS);
  }
  return posts;
}

async function fetchPost(blogId, logNo) {
  const url = `https://blog.naver.com/PostView.naver?blogId=${encodeURIComponent(
    blogId
  )}&logNo=${logNo}&redirect=Dlog&widgetTypeCall=true&directAccess=false`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`본문 조회 실패 (logNo ${logNo}): HTTP ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const title =
    $(".se-title-text").first().text().trim() ||
    $(".pcol1 .itemSubjectBoldfont").first().text().trim() ||
    $(".htitle").first().text().trim() ||
    $("#title").first().text().trim();

  const bodyEl = $(".se-main-container").first().length
    ? $(".se-main-container").first()
    : $("#postViewArea").first();
  bodyEl.find("script, style").remove();
  const content = bodyEl
    .text()
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    logNo,
    title,
    url: `https://blog.naver.com/${blogId}/${logNo}`,
    content,
  };
}

async function main() {
  const [blogId, outputFile = "naver-posts.json"] = process.argv.slice(2);
  if (!blogId) {
    console.error("사용법: node scripts/naver-blog-crawler.mjs <blogId> [outputFile]");
    process.exit(1);
  }

  console.log(`[1/2] ${blogId} 글 목록 수집 중...`);
  const list = await fetchPostList(blogId);
  console.log(`  -> ${list.length}개 글 발견`);

  console.log("[2/2] 글 본문 수집 중...");
  const posts = [];
  for (const [i, { logNo }] of list.entries()) {
    process.stdout.write(`\r  -> ${i + 1}/${list.length}`);
    try {
      posts.push(await fetchPost(blogId, logNo));
    } catch (err) {
      console.warn(`\n  [경고] logNo ${logNo} 실패: ${err.message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  console.log();

  await writeFile(outputFile, JSON.stringify(posts, null, 2), "utf-8");
  console.log(`완료: ${posts.length}개 글 저장 -> ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
