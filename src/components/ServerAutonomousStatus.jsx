// ════════════════════════════════════════════════════════════════════
// ServerAutonomousStatus — 서버 자율 트리거 상태 (Phase 39)
//
//   브라우저가 닫혀 있어도 외부 스케줄러가 서버 엔드포인트를 호출하면 DB 기반으로
//   운영이 이어진다. 이 카드는 설정 안내 + DB 현황(예약/도래/대기 draft)을 보여준다.
//   ⚠️ 비밀키(CRON_SECRET)는 서버 전용 — 화면/번들/응답 어디에도 출력하지 않는다.
//   ⚠️ 읽기 전용(anon) 집계 · additive. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { supabase } from "../lib/supabase";

const cell = (bg, color) => ({
  flex: "1 1 90px", textAlign: "center", background: bg, borderRadius: R.md, padding: "10px 6px", color,
});

export default function ServerAutonomousStatus() {
  const [stat, setStat] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const [scheduled, due, drafts] = await Promise.all([
        supabase.from("lounge_posts").select("id", { count: "exact", head: true }).eq("publish_status", "scheduled"),
        supabase.from("lounge_posts").select("id", { count: "exact", head: true }).eq("publish_status", "scheduled").lte("scheduled_at", nowIso),
        supabase.from("lounge_posts").select("id", { count: "exact", head: true }).eq("publish_status", "draft").not("ai_topic", "is", null),
      ]);
      setStat({ scheduled: scheduled.count ?? 0, due: due.count ?? 0, drafts: drafts.count ?? 0 });
    } catch {
      setStat({ scheduled: 0, due: 0, drafts: 0 });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };
  const mono = { fontFamily: "monospace", fontSize: 11.5, background: C.bg, borderRadius: R.sm, padding: "2px 6px", color: C.text2, wordBreak: "break-all" };

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: S.sm }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>🛰️ 서버 자율 트리거 (브라우저 닫혀도 운영)</div>
        <button onClick={load} style={{ padding: "4px 12px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>새로고침</button>
      </div>

      <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.7, marginBottom: S.md }}>
        외부 스케줄러(예: cron-job.org, 5분 주기)가 아래 엔드포인트를 호출하면, 관리자 화면이 꺼져 있어도 서버가
        <b> DB 상태</b>만으로 (1) 오늘 부족한 draft 자동 생성(중복 방지) (2) <b>관리자가 승인·예약</b>하고 시각이 도래한 글을 자동 발행합니다.
      </div>

      {/* DB 현황 */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
        <div style={cell(C.bg, C.text2)}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text1 }}>{loading ? "…" : stat?.scheduled ?? 0}</div>
          <div style={{ fontSize: 10.5 }}>예약(scheduled)</div>
        </div>
        <div style={cell(stat?.due > 0 ? "#dc262215" : C.bg, stat?.due > 0 ? C.red : C.text2)}>
          <div style={{ fontSize: 20, fontWeight: 800, color: stat?.due > 0 ? C.red : C.text1 }}>{loading ? "…" : stat?.due ?? 0}</div>
          <div style={{ fontSize: 10.5 }}>도래(발행 대기)</div>
        </div>
        <div style={cell(C.bg, C.text2)}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text1 }}>{loading ? "…" : stat?.drafts ?? 0}</div>
          <div style={{ fontSize: 10.5 }}>AI draft 대기</div>
        </div>
      </div>

      {/* 설정 안내 */}
      <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 2 }}>
        <div>· 엔드포인트: <span style={mono}>POST {origin}/api/cron/autonomous-cycle</span></div>
        <div>· 헤더: <span style={mono}>Authorization: Bearer &lt;CRON_SECRET&gt;</span> <span style={{ color: C.text4 }}>(비밀키는 서버 환경변수 전용 · 화면 미출력)</span></div>
        <div>· 주기 권장: <b>5분</b> (Vercel Hobby Cron 은 일 1회 제한 → 외부 스케줄러 사용)</div>
      </div>

      <div style={{ fontSize: 10.5, color: C.text3, marginTop: S.md, lineHeight: 1.7, borderTop: `1px solid ${C.bgWarm}`, paddingTop: S.sm }}>
        ⚠️ 한계: 무인 운영 토글·자동발행 ON/OFF·긴급정지·큐는 <b>관리자 브라우저 localStorage</b>에 있어 서버가 읽지 못합니다.
        서버 사이클은 <b>DB의 승인·예약 글만</b> 발행하며(Safety Gate), 새 승인 결정은 내리지 않습니다.
        서버 운영을 멈추려면 외부 스케줄러를 끄거나 CRON_SECRET 을 제거하세요.
      </div>
    </div>
  );
}
