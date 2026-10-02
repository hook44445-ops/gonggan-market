import { Fragment } from "react";

// 글자 조각(content/publicPages.js) → 화면. 문자열은 그대로, { b } 는 굵게, "\n" 은 줄바꿈.
//   봇 프리렌더는 같은 조각을 segHtml 로 낸다 — 사람과 봇이 같은 문장을 본다.
export default function RichText({ segs, strongStyle }) {
  const list = Array.isArray(segs) ? segs : [segs];
  return list.map((x, i) => {
    if (typeof x !== "string") return <strong key={i} style={strongStyle}>{x?.b}</strong>;
    const lines = x.split("\n");
    return <Fragment key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{l}</Fragment>)}</Fragment>;
  });
}
