// 가격 데이터 — 견적 요청·견적서에 이미 적힌 값으로 «표준 칸»(평수 m²·건물 유형·지역 코드·자재 등급)을 채운다.
// 고객·업체에게 새로 묻지 않는다(입력 부담 0). 모르면 null — 추측으로 채우지 않는다.
// 이 칸들이 쌓여야 «우리 동네 평당 시세»(space_price_index · 013/106)를 만들 수 있다.

const PYEONG_M2 = 3.3058;

// "24평" · "33평형" · "84㎡" · "84m2" · "20~30평" · "10평대" → m²(소수 1자리). 「평수 무관」·빈값·숫자 없음 → null
export function sizeToM2(size) {
  const s = String(size ?? "").replace(/,/g, "").trim();
  if (!s || /무관|모름|상담/.test(s)) return null;
  const nums = (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
  if (!nums.length) return null;
  let n;
  if (/대/.test(s) && nums.length === 1) n = nums[0] + 5;                 // 10평대 → 15평
  else if (/이상/.test(s) && nums.length === 1) n = nums[0] + 5;          // 40평 이상 → 45평(대략)
  else n = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];           // 20~30평 → 25평
  const isM2 = /㎡|m2|m²|제곱/i.test(s);
  const m2 = isM2 ? n : n * PYEONG_M2;
  if (m2 < 1 || m2 > 5000) return null;                                     // 오타(예: 3300평) 거르기
  return Math.round(m2 * 10) / 10;
}

// 공간 유형(요청서 칩) → 건물 유형. 모르는 유형은 null
const BUILDING_BY_SPACE = {
  "아파트 전체": "apartment", "아파트 부분": "apartment",
  "원룸/오피스텔": "officetel",
  "카페/식당": "commercial", "상가": "commercial",
  "오피스": "office",
};
export function buildingTypeOf(spaceType) {
  const t = String(spaceType ?? "").trim();
  if (BUILDING_BY_SPACE[t]) return BUILDING_BY_SPACE[t];
  if (/아파트/.test(t)) return "apartment";
  if (/빌라|다세대|연립/.test(t)) return "villa";
  if (/단독|주택/.test(t)) return "house";
  if (/오피스텔|원룸/.test(t)) return "officetel";
  if (/사무|오피스/.test(t)) return "office";
  if (/상가|매장|카페|식당|점포/.test(t)) return "commercial";
  return null;
}

// 지역(「서울 강서구」 형식) → 시·도 행정 코드 2자리. 통계는 시·도 단위로 모은다(표본이 흩어지지 않게).
const SIDO_CODE = [
  [/^서울/, "11"], [/^부산/, "26"], [/^대구/, "27"], [/^인천/, "28"], [/^광주/, "29"], [/^대전/, "30"],
  [/^울산/, "31"], [/^세종/, "36"], [/^경기/, "41"], [/^강원/, "51"], [/^충(청)?북/, "43"], [/^충(청)?남/, "44"],
  [/^전(라)?북|^전북/, "52"], [/^전(라)?남/, "46"], [/^경(상)?북/, "47"], [/^경(상)?남/, "48"], [/^제주/, "50"],
];
export function regionCodeOf(area) {
  const a = String(area ?? "").trim();
  for (const [re, code] of SIDO_CODE) if (re.test(a)) return code;
  return null;
}

// 요청 저장 때 같이 넣을 표준 칸
export function requestPriceFields({ spaceType, size, area } = {}) {
  return {
    space_size_m2: sizeToM2(size),
    building_type: buildingTypeOf(spaceType),
    region_code:   regionCodeOf(area),
  };
}

// 견적서 자재 등급(업체가 한 번 누름 — 선택)
export const MATERIAL_GRADES = [
  { key: "economy",  label: "실속" },
  { key: "standard", label: "표준" },
  { key: "premium",  label: "고급" },
  { key: "luxury",   label: "최고급" },
];

// 운영 DB 에 칸이 아직 없을 때(170 실행 전) — 이 칸들 때문에 저장이 실패했는지
export function isMissingColumnError(error, cols = ["space_size_m2", "building_type", "region_code"]) {
  const m = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return /PGRST204|42703/.test(m) || cols.some((c) => m.includes(c));
}
