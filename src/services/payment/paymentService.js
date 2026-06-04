// ── 결제 서비스 — provider 레지스트리 + 진입점 ──────────────────────────────
// 화면은 provider 구현을 직접 import 하지 않고 getProvider() 로만 접근한다.
import * as toss from "./providers/tossProvider";
import * as nice from "./providers/niceProvider";
import * as kb from "./providers/kbProvider";
import { ACTIVE_PROVIDER } from "./constants";

const REGISTRY = { TOSS: toss, NICE: nice, KB: kb };

export function getProvider(providerId = ACTIVE_PROVIDER) {
  const p = REGISTRY[providerId];
  if (!p) throw new Error(`Unknown payment provider: ${providerId}`);
  return p;
}

// 현재 실연동 provider 어댑터(편의).
export function getActiveProvider() {
  return getProvider(ACTIVE_PROVIDER);
}
