// ─────────────────────────────────────────────────────
// v3 UI 키트 — 화면 정리 + 첫인상 매력도를 위한 공용 프리미티브.
//
// 설계 원칙
//  1) 리듬: 섹션 간격·카드 반경·그림자를 한 곳에서 통일한다.
//  2) 밀도: 빈 섹션을 큰 회색 박스로 늘어놓지 않는다. 한 줄로 접고, 대신 '초대'한다.
//  3) 온도: 상단에 인사/성취를 보여주는 히어로를 둬 첫 화면에서 기분이 좋게 한다.
//  4) 테마: 색은 전부 C 토큰만 사용 → 고객(그린)/파트너(네이비) 자동 전환.
// ─────────────────────────────────────────────────────
import { useState } from "react";
import { C, R, S, SHADOW } from "../../constants";
import Icon from "../common/Icon";

/* 화면 전체를 감싸는 래퍼 — 좌우 여백과 섹션 리듬을 고정한다. */
export function Page({ children, pad = true }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 96 }}>
      <div style={{ padding: pad ? `0 ${S.xl}px` : 0, display: "flex", flexDirection: "column", gap: 24 }}>
        {children}
      </div>
    </div>
  );
}

/* 섹션 — 제목(선택) + 우측 액션(선택) + 본문. 제목이 없으면 여백만 잡는다. */
export function Section({ title, action, onAction, children, tight = false }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: tight ? S.sm : S.md }}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: `0 ${S.xs}px` }}>
          {title && <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text1, letterSpacing: "-0.35px" }}>{title}</h2>}
          {action && (
            <button onClick={onAction} style={{ background: "none", border: "none", padding: 0, fontSize: 12.5,
              fontWeight: 700, color: C.text3, cursor: "pointer" }}>
              {action}
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/* 카드 — 모든 면의 기본 단위. 톤(plain/brand)과 패딩만 조절한다. */
export function Card({ children, tone = "plain", pad = S.lg, onClick, style }) {
  const brand = tone === "brand";
  return (
    <div
      onClick={onClick}
      style={{
        background: brand ? C.brandL : C.surface,
        border: `1px solid ${brand ? C.brandM : C.bgWarm}`,
        borderRadius: R.xl, padding: pad, boxShadow: SHADOW.soft,
        cursor: onClick ? "pointer" : "default", ...style,
      }}
    >
      {children}
    </div>
  );
}

/* 리스트 행 — 아이콘 + 라벨 + (값/배지) + 쉐브론. 카드 안에 여러 개를 쌓는다. */
export function Row({ emoji, label, sub, value, badge, onClick, last = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: S.md, padding: `${S.md}px 0`,
        borderBottom: last ? "none" : `1px solid ${C.bg}`, cursor: onClick ? "pointer" : "default",
      }}
    >
      {emoji && (
        <span style={{ width: 34, height: 34, borderRadius: R.md, background: C.brandL,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon emoji={emoji} size={17} color={C.brand} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{sub}</div>}
      </div>
      {badge != null && (
        <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full,
          padding: "3px 9px", fontSize: 11.5, fontWeight: 800 }}>{badge}</span>
      )}
      {value != null && <span style={{ fontSize: 13, fontWeight: 700, color: C.text2 }}>{value}</span>}
      {onClick && <span style={{ fontSize: 16, color: C.text4, flexShrink: 0 }}>›</span>}
    </div>
  );
}

/* 통계 타일 — 탭 가능한 요약 숫자. 빈 값이어도 초라해 보이지 않게 라벨을 살린다. */
export function StatTiles({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: S.sm }}>
      {items.map(({ label, value, emoji, onClick }, i) => (
        <div key={i} onClick={onClick}
          style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg,
            padding: `${S.md}px ${S.xs}px`, textAlign: "center", cursor: onClick ? "pointer" : "default",
            boxShadow: SHADOW.soft }}>
          {emoji && <div style={{ marginBottom: 4 }}><Icon emoji={emoji} size={16} color={C.text3} /></div>}
          <div style={{ fontSize: 20, fontWeight: 900, color: value ? C.brand : C.text4, lineHeight: 1.1 }}>{value ?? 0}</div>
          <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

/* 빈 상태 '초대' — 큰 회색 박스 대신 한 줄짜리 권유 + CTA. 화면을 잡아먹지 않는다. */
export function EmptyInvite({ text, cta, onCta }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${S.md}px ${S.lg}px`,
      background: C.surface2, border: `1px dashed ${C.bgWarm}`, borderRadius: R.lg }}>
      <div style={{ flex: 1, fontSize: 12.5, color: C.text3, lineHeight: 1.5 }}>{text}</div>
      {cta && (
        <button onClick={onCta} style={{ flexShrink: 0, background: C.brand, color: "#fff", border: "none",
          borderRadius: R.full, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          {cta}
        </button>
      )}
    </div>
  );
}

/* 히어로 — 첫인상 담당. 브랜드 그라데이션 + 인사 + 요약 지표. */
export function Hero({ eyebrow, title, sub, chips = [], actions = [] }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: R.xl,
      background: `linear-gradient(135deg, ${C.brand}, ${C.brandD})`, color: "#fff",
      padding: `${S.xxl}px ${S.xl}px`, boxShadow: SHADOW.brand }}>
      {/* 은은한 광택 — 단색 면을 덜 밋밋하게 */}
      <div aria-hidden style={{ position: "absolute", right: -60, top: -70, width: 190, height: 190,
        borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
      {eyebrow && <div style={{ fontSize: 11.5, opacity: 0.75, marginBottom: 6, letterSpacing: "0.2px" }}>{eyebrow}</div>}
      <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: "-0.6px", lineHeight: 1.32 }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, opacity: 0.78, marginTop: 7, lineHeight: 1.62, letterSpacing: "-0.1px" }}>{sub}</div>}

      {chips.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: S.lg, flexWrap: "wrap" }}>
          {chips.map((c, i) => (
            <span key={i} style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: R.full, padding: "5px 10px", fontSize: 11, fontWeight: 700,
              whiteSpace: "nowrap", letterSpacing: "-0.1px" }}>{c}</span>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
          {actions.map(({ label, onClick, primary }, i) => (
            <button key={i} onClick={onClick}
              style={{ flex: 1, height: 44, borderRadius: R.lg, fontSize: 14, fontWeight: 800, cursor: "pointer",
                background: primary ? "#fff" : "rgba(255,255,255,0.16)",
                color: primary ? C.brandD : "#fff",
                border: primary ? "none" : "1px solid rgba(255,255,255,0.28)" }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* 진행 바 — 등급/레벨처럼 '쌓이는 느낌'을 주는 요소. */
export function Progress({ pct, label, right }) {
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div>
      {(label || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          {label && <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text2 }}>{label}</span>}
          {right && <span style={{ fontSize: 12, color: C.text3 }}>{right}</span>}
        </div>
      )}
      <div style={{ height: 7, borderRadius: R.full, background: C.bgWarm, overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", borderRadius: R.full,
          background: `linear-gradient(90deg, ${C.brandSoft}, ${C.brand})`, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}

/* 섹션 제목 없는 얇은 구분 — 설정/법적 정보처럼 비중이 낮은 묶음에 쓴다. */
export function QuietList({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map(({ label, onClick, danger }, i) => (
        <button key={i} onClick={onClick}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "none", border: "none", borderBottom: `1px solid ${C.bgWarm}`,
            padding: `${S.md}px ${S.xs}px`, fontSize: 13, cursor: "pointer",
            color: danger ? C.red : C.text3, textAlign: "left", width: "100%" }}>
          <span>{label}</span><span style={{ color: C.text4 }}>›</span>
        </button>
      ))}
    </div>
  );
}

/* 사진 타일 — 시공 사례처럼 '보여주는' 콘텐츠. 첫인상에서 가장 강한 요소. */
export function PhotoTile({ src, title, meta, onClick, height = 150 }) {
  return (
    <div onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", borderRadius: R.lg,
      overflow: "hidden", background: C.surface, border: `1px solid ${C.bgWarm}`, boxShadow: SHADOW.soft }}>
      <div style={{ position: "relative", height, background: C.bgWarm }}>
        {/* 이미지 로드 실패(네트워크·CDN 장애) 시 깨진 alt 대신 중립 배경만 남긴다. */}
        {src && <img src={src} alt="" loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
        <div aria-hidden style={{ position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.42) 100%)" }} />
        {title && (
          <div style={{ position: "absolute", left: S.md, right: S.md, bottom: S.sm, color: "#fff" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-0.2px" }}>{title}</div>
            {meta && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{meta}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* 신뢰 지표 줄 — 숫자 3개로 '안심'을 즉시 전달한다(사회적 증거). */
export function TrustRow({ items }) {
  return (
    <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.bgWarm}`,
      borderRadius: R.xl, padding: `${S.lg}px ${S.sm}px`, boxShadow: SHADOW.soft }}>
      {items.map(({ value, label }, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center", position: "relative" }}>
          {i > 0 && <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 1, background: C.bgWarm }} />}
          <div style={{ fontSize: 17, fontWeight: 900, color: C.brand, lineHeight: 1.2 }}>{value}</div>
          <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

/* 로딩 인디케이터 — 이모지 대신. size/두께만 조절한다. */
export function Spinner({ size = 22, width = 2.5, color = C.text3 }) {
  return (
    <span className="gg-spinner" aria-label="불러오는 중"
      style={{ width: size, height: size, borderWidth: width, color }} />
  );
}

/* 긴 글 접기 — 기본은 몇 줄만 보이고 「더 보기」로 펼친다. 짧은 글에는 버튼을 달지 않는다. */
export function FoldText({ text, lines = 3, minChars = 90, style }) {
  const [open, setOpen] = useState(false);
  const long = (text ?? "").length > minChars || (text ?? "").split(/\r?\n/).length > lines;
  return (
    <div>
      <div style={{ whiteSpace: "pre-wrap", ...(long && !open ? { display: "-webkit-box", WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical", overflow: "hidden" } : null), ...style }}>{text}</div>
      {long && (
        <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} aria-expanded={open}
          style={{ marginTop: 6, background: "none", border: "none", padding: 0, cursor: "pointer",
            fontSize: 12.5, fontWeight: 700, color: C.brand }}>
          {open ? "접기 ▲" : "더 보기 ▼"}
        </button>
      )}
    </div>
  );
}
