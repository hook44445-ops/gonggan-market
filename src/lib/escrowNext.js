// 공사 진행(에스크로) 화면 맨 위 「지금 할 일」 — 순수 함수(네트워크 0 · 상태 변경 0).
//
// 왜: 진행 화면은 보호 배너·약속·금액·완공일이 먼저 나오고 단계 버튼이 8번째 블록에 있었다.
// 들어오자마자 «지금 내가 뭘 하면 되나»가 보이도록, 이미 계산된 stageStatus 만 읽어 한 줄로 말한다.
// 버튼은 해당 단계 칸으로 스크롤할 뿐이다 — 승인·지급·정산 로직은 그대로 EscrowScreen 이 한다.
//
// stageStatus: { 1..5: "done" | "company_todo" | "pending_customer" | "locked" }

export const STAGE_IDS = [1, 2, 3, 4, 5];
// 문장 안에서 부르는 짧은 이름 — 단계 이름(「공사 시작 확인」)을 그대로 넣으면 «확인 사진을 확인»처럼 겹친다.
export const PHOTO_WORD = { 3: "착공", 4: "중간 점검", 5: "완공" };

export function progressSteps(stageStatus = {}) {
  return STAGE_IDS.map((id) => {
    const st = stageStatus[id];
    return { id, state: st === "done" ? "done" : (st === "company_todo" || st === "pending_customer") ? "active" : "locked" };
  });
}

/**
 * @param {object} p
 * @param {object} p.stageStatus
 * @param {boolean} p.isConsumer
 * @param {object} p.labels        { [id]: 단계 이름(보는 사람 기준) }
 * @param {boolean} [p.settled]    정산 완료(SETTLED) 또는 5단계 done
 * @param {boolean} [p.disputed]   이의 신청 중(동결)
 * @param {boolean} [p.reviewed]   의뢰인이 후기를 남겼나
 */
export function nextAction({ stageStatus = {}, isConsumer, labels = {}, settled = false, disputed = false, reviewed = false }) {
  const name = (id) => PHOTO_WORD[id] ?? labels[id] ?? `${id}단계`;
  if (disputed) {
    return { tone: "warn", stageId: null, title: "이의 신청을 확인하고 있어요",
      sub: "공간마켓이 기록(사진·GPS·채팅)을 보고 연락드려요. 그동안 단계 진행은 잠시 멈춥니다.", cta: null, anchor: null };
  }
  if (settled || stageStatus[5] === "done") {
    return isConsumer
      ? (reviewed
          ? { tone: "done", stageId: 5, title: "공사가 마무리됐어요", sub: "모든 단계 기록이 이 화면에 남아 있어요.", cta: null, anchor: null }
          : { tone: "done", stageId: 5, title: "공사가 마무리됐어요 — 후기를 남겨 주세요", sub: "사진 후기는 다음 고객에게 이 업체를 알리는 가장 큰 힘이 돼요.", cta: "후기 쓰기", anchor: "escrow-review" })
      : { tone: "done", stageId: 5, title: "모든 단계가 끝났어요", sub: "완료 사진으로 시공 사례를 만들면 고객 홈에 업체 이름과 함께 올라가요.", cta: null, anchor: null };
  }
  const cur = STAGE_IDS.find((id) => stageStatus[id] === "company_todo" || stageStatus[id] === "pending_customer");
  if (!cur) {
    return { tone: "wait", stageId: null, title: "진행 준비 중이에요", sub: "계약 정보를 불러오는 중이거나 다음 단계를 기다리고 있어요.", cta: null, anchor: null };
  }
  const st = stageStatus[cur];
  if (st === "pending_customer") {
    return isConsumer
      ? { tone: "act", stageId: cur, title: `${name(cur)} 사진이 올라왔어요`, sub: "사진과 현장 기록을 보고 확인해 주세요. 확인해야 다음 단계로 넘어가요.", cta: "사진 확인하기", anchor: `stage-${cur}` }
      : { tone: "wait", stageId: cur, title: `${name(cur)} 사진 — 고객 확인을 기다리고 있어요`, sub: "고객이 확인하면 알림으로 알려드려요.", cta: "올린 사진 보기", anchor: `stage-${cur}` };
  }
  return isConsumer
    ? { tone: "wait", stageId: cur, title: `업체가 ${name(cur)} 사진을 준비하고 있어요`, sub: "사진이 올라오면 알림으로 알려드려요.", cta: null, anchor: null }
    : { tone: "act", stageId: cur, title: `${name(cur)} 사진을 올려 주세요`, sub: "현장에서 찍은 사진과 위치가 함께 기록돼요.", cta: "사진 올리기", anchor: `stage-${cur}` };
}
