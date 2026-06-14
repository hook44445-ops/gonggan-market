// ── 테스트 계정 매칭 헬퍼(071) ────────────────────────────────────────────────
// list_test_accounts(RPC) 결과로 테스트 계정 집합을 만들고,
// admin_project_flow_list 행의 customer 가 테스트 계정인지 판정한다.
// 매칭 우선순위: customer.id(= users.id) → 보조로 전화번호(숫자 정규화) 비교.
// 기존 RPC/계산식은 일절 건드리지 않고, 프론트에서 입력 행을 필터링하는 용도.

export function normalizePhone(p) {
  const digits = String(p ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // 국가코드(82) 제거 후 끝 10자리 기준으로 통일 → 0 접두어 형태로 정규화
  let d = digits;
  if (d.startsWith("82")) d = d.slice(2);
  if (!d.startsWith("0")) d = "0" + d;
  return d;
}

// list 는 [{ id, name, phone, role, ... }]
export function buildTestAccountSet(list) {
  const ids = new Set();
  const phones = new Set();
  for (const u of list || []) {
    if (u?.id) ids.add(String(u.id));
    const np = normalizePhone(u?.phone);
    if (np) phones.add(np);
  }
  return { ids, phones };
}

// row.customer = { id, name, phone }
export function isTestRow(row, set) {
  if (!set) return false;
  const c = row?.customer;
  if (!c) return false;
  if (c.id && set.ids.has(String(c.id))) return true;
  const np = normalizePhone(c.phone);
  if (np && set.phones.has(np)) return true;
  return false;
}
