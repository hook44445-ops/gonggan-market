import { useEffect, useRef, useState } from "react";
import "../../styles/landingMotion.css";

// 랜딩 움직임 조각들(고객 / · 파트너 /partner) — 2026-09-30 대표 「프리미엄 1등 느낌 · 동적인 매력 · 걱정과 해결을 유머와 매력으로」.
// ⚠️ 여기 그려지는 것은 전부 앱에 «실제로 있는» 흐름이다. 예시(업체·금액·알림)는 화면에 «예시»로 적는다.

const reduceMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

// 화면에 들어오면 한 번 true(되돌리지 않는다)
export function useInView({ threshold = 0.25, rootMargin = "0px 0px -8% 0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold, rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);
  return [ref, inView];
}

export function Reveal({ as: Tag = "div", className = "", delay = 0, style, children, ...rest }) {
  const [ref, inView] = useInView({ threshold: 0.12 });
  return (
    <Tag ref={ref} className={`lm-reveal ${inView ? "is-in" : ""} ${className}`} style={{ transitionDelay: `${delay}s`, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

// 숫자가 0에서 목표까지 올라간다(만원 단위 · 콤마)
export function CountUp({ to, start, duration = 1100, suffix = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (reduceMotion()) { setV(to); return; }
    let raf; const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, start, duration]);
  return <>{v.toLocaleString("ko-KR")}{suffix}</>;
}

// ── 히어로 — 두 장면(거실 → 주방)이 천천히 바뀌고 가장자리에서 점토 소품이 숨 쉰다 ──
const SCENES = [
  { wide: "/images/landing/hero-living-wide.webp", tall: "/images/landing/hero-living-tall.webp", label: "거실" },
  { wide: "/images/landing/hero-kitchen-wide.webp", tall: "/images/landing/hero-kitchen-tall.webp", label: "주방" },
];
export function HeroScenes({ children, clay = true, scenes = SCENES, interval = 7000 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (scenes.length < 2 || reduceMotion()) return;
    const t = setInterval(() => setI((x) => (x + 1) % scenes.length), interval);
    return () => clearInterval(t);
  }, [scenes.length, interval]);
  return (
    <div className="lm-hero gm-hero">
      {scenes.map((s, k) => (
        <picture key={s.wide} className={`lm-scene ${k === i ? "is-on" : ""}`} aria-hidden="true">
          <source media="(max-width: 699px)" srcSet={s.tall} />
          <img src={s.wide} alt="" fetchpriority={k === 0 ? "high" : "low"} loading={k === 0 ? "eager" : "lazy"} decoding="async" />
        </picture>
      ))}
      <div className="lm-hero-ov" />
      {clay && (
        <>
          <div className="lm-clay c1"><img src="/images/landing/clay-roller.webp" alt="" aria-hidden="true" /></div>
          <div className="lm-clay c2"><img src="/images/landing/clay-chips.webp" alt="" aria-hidden="true" /></div>
          <div className="lm-clay c3"><img src="/images/landing/clay-tape.webp" alt="" aria-hidden="true" /></div>
          <div className="lm-clay c4"><img src="/images/landing/clay-house.webp" alt="" aria-hidden="true" /></div>
        </>
      )}
      <div className="lm-hero-ct gm-hero-ct">{children}</div>
      {scenes.length > 1 && (
        <div className="lm-dots" role="tablist" aria-label="장면">
          {scenes.map((s, k) => (
            <button key={s.label} type="button" aria-label={s.label} aria-selected={k === i} className={k === i ? "is-on" : ""} onClick={() => setI(k)} />
          ))}
        </div>
      )}
    </div>
  );
}

// 증빙 칩 셋 — 차례로 «딸깍»
export function ProofChips({ items = [["biz", "사업자 확인"], ["insurance", "시공보험"], ["deposit", "보증금"]], base = 0.5 }) {
  return (
    <div className="lm-proofs">
      {items.map(([k, label], n) => (
        <span key={k} className="lm-proof" style={{ animationDelay: `${base + n * 0.28}s` }}>
          <img src={`/images/emblem/${k}-sm.webp`} alt="" aria-hidden="true" width="22" height="22" />{label} ✓
        </span>
      ))}
    </div>
  );
}

// ── 걱정 한 줄 → 금빛 도장 «쾅» → 답. 누르면 다시 찍는다 ──
function WorryCard({ w, i }) {
  const [ref, inView] = useInView({ threshold: 0.45 });
  const [nonce, setNonce] = useState(0);
  const on = inView;
  return (
    <div ref={ref} key={nonce} className={`lm-worry ${on ? "is-in" : ""}`} style={{ animationDelay: `${0.42 + (i % 2) * 0.12}s` }}
      role="button" tabIndex={0} aria-label={`${w.q} — ${w.plain ?? ""}`}
      onClick={() => setNonce((n) => n + 1)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setNonce((n) => n + 1); }}>
      <div className="lm-worry-top">
        {w.icon && <img className="lm-worry-ic" src={w.icon} alt="" aria-hidden="true" loading="lazy" />}
        <div className="lm-worry-q">{w.q}</div>
      </div>
      <div className="lm-seal" aria-hidden="true">{w.seal ?? <span><small>공간마켓</small><br />해결</span>}</div>
      <div className="lm-worry-a">{w.a}</div>
    </div>
  );
}
export function WorryStamps({ items, cols3 = false }) {
  return (
    <div className={`lm-worries ${cols3 ? "is-3" : ""}`}>
      {items.map((w, i) => <WorryCard key={w.q} w={w} i={i} />)}
    </div>
  );
}

// ── 전·후 밀어 보기(예시 사진) — 보이면 한 번 스르륵 움직여 «밀 수 있다»를 알려 준다 ──
export function BeforeAfter({ before, after, label = "예시" }) {
  const [x, setX] = useState(50);
  const [hint, setHint] = useState(false);
  const [ref, inView] = useInView({ threshold: 0.5 });
  const touched = useRef(false);
  useEffect(() => {
    if (!inView || reduceMotion()) return;
    setHint(true);
    const steps = [[200, 22], [1500, 78], [2800, 50], [4000, null]];
    const ts = steps.map(([ms, v]) => setTimeout(() => { if (touched.current) return; if (v == null) setHint(false); else setX(v); }, ms));
    return () => ts.forEach(clearTimeout);
  }, [inView]);
  return (
    <div ref={ref} className={`lm-ba ${hint ? "is-hint" : ""}`} style={{ "--x": `${x}%` }}>
      <img src={before} alt="공사 전(예시)" loading="lazy" />
      <img className="after" src={after} alt="공사 후(예시)" loading="lazy" />
      <span className="lm-ba-tag" style={{ left: 12 }}>전</span>
      <span className="lm-ba-tag" style={{ right: 12, background: "rgba(200,168,106,.92)", color: "#121A16" }}>후</span>
      {label && <span className="lm-ba-tag" style={{ left: "50%", transform: "translateX(-50%)", top: "auto", bottom: 12, background: "rgba(255,255,255,.9)", color: "#121A16" }}>{label}</span>}
      <div className="lm-ba-bar" />
      <div className="lm-ba-knob" aria-hidden="true">⇆</div>
      <input type="range" min="0" max="100" value={x} aria-label="공사 전후 비교 — 밀어서 보기"
        onChange={(e) => { touched.current = true; setHint(false); setX(+e.target.value); }} />
    </div>
  );
}

// ── 공사 이름이 흐른다(두 줄 · 반대 방향) ──
export function WorkMarquee({ rows }) {
  return (
    <div className="lm-marquee" aria-hidden="true">
      {rows.map((row, r) => (
        <div key={r} className={`lm-marquee-row ${r % 2 ? "rev" : ""}`}>
          {[...row, ...row].map((t, k) => <span key={k} className={t.startsWith("★") ? "gold" : ""}>{t.replace(/^★/, "")}</span>)}
        </div>
      ))}
    </div>
  );
}

// ── 파트너 히어로: 새 요청 알림이 톡톡 도착(예시) ──
export function RequestPings({ items, interval = 2600 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduceMotion()) { setN(items.length - 1); return; }
    const t = setInterval(() => setN((x) => x + 1), interval);
    return () => clearInterval(t);
  }, [items.length, interval]);
  const shown = Math.min(3, items.length);
  return (
    <div className="lm-pings" aria-label="알림 예시">
      {Array.from({ length: shown }).map((_, slot) => {
        const it = items[(n - slot + items.length * 10) % items.length];
        const depth = slot;
        return (
          <div key={`${n - slot}`} className="lm-ping" style={{
            top: depth * 14, zIndex: 10 - depth, opacity: depth === 0 ? 1 : 0.75 - depth * 0.25,
            transform: `scale(${1 - depth * 0.05}) translateY(${depth * 6}px)`,
            animation: depth === 0 ? "lm-pop .6s cubic-bezier(.34,1.56,.64,1) both" : "none",
          }}>
            <img src={it.icon} alt="" aria-hidden="true" style={{ visibility: depth === 0 ? "visible" : "hidden" }} />
            <div style={{ minWidth: 0, visibility: depth === 0 ? "visible" : "hidden" }}>
              <div className="lm-ping-t">{it.t}</div>
              <div className="lm-ping-b">{it.b}</div>
              {it.s && <div className="lm-ping-s">{it.s}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 광고 영상(클레이 · 23초 · 소리 없음) — 화면에 보일 때만 재생하고 벗어나면 멈춘다(데이터·배터리 아끼기).
//    움직임 줄이기면 자동재생하지 않고 재생 단추를 둔다. 영상이 못 오면 포스터 그림만 남는다.
export function AdVideo({ src = "/video/gonggan-ad.mp4", poster = "/video/gonggan-ad-poster.jpg", label = "공간마켓 소개 영상" }) {
  const ref = useRef(null);
  const [calm] = useState(() => reduceMotion());
  useEffect(() => {
    const v = ref.current;
    if (!v || calm || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { v.play?.().catch(() => {}); } else { v.pause?.(); }
    }, { threshold: 0.45 });
    io.observe(v);
    return () => io.disconnect();
  }, [calm]);
  return (
    <div className="lm-ad">
      <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" controls={calm}
        aria-label={label} style={{ width: "100%", height: "auto", display: "block", aspectRatio: "16 / 9", background: "#1D3D2F" }} />
    </div>
  );
}
