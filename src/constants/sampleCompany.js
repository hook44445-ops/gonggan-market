// 예시 업체 — 「업체는 이렇게 보여요」를 의뢰인·파트너 모두에게 보여주는 **표시용 견본**.
// 실제 업체가 아니므로 모든 화면에서 「예시」로 표시하고, 상담·후기·입찰 대상이 되지 않는다.
// 사진은 힉스필드로 만든 견본(public/images/sample). 숫자도 견본이다.
const P = "/images/sample/";

export const SAMPLE_COMPANY_ID = "sample-company";

export const SAMPLE_COMPANY = {
  id: SAMPLE_COMPANY_ID,
  isSample: true,
  name: "예시 인테리어",
  temp: 38.4,
  region: "우리 동네",
  verified: true,
  bizCert: true,
  insurance: true,
  online: true,
  responseTime: "1시간 이내",
  avgResponseHours: 1,
  completedJobs: 42,
  recontractRate: 30,
  asRate: 98,
  years: 8,
  specialties: ["아파트 전체", "욕실", "주방"],
  desc: "공간마켓에 입점한 업체는 이렇게 보여요. 시공 사진·후기·응답 속도가 한눈에 모입니다.",
  cover: P + "cover.webp",
  logo: P + "logo.webp",          // 업체 얼굴 — 프로필 아바타(힉스필드 견본)
  portfolio: [
    { id: "s1", type: "아파트 전체", title: "32평 거실 전체 리모델링", area: "32평", tags: ["도배", "바닥", "조명"],
      beforePhotos: [P + "living-before.webp"], afterPhotos: [P + "living-after.webp", P + "cover.webp"],
      before: P + "living-before.webp", after: P + "living-after.webp" },
    { id: "s2", type: "욕실", title: "욕실 전체 교체", area: "5㎡", tags: ["타일", "샤워부스", "수전"],
      beforePhotos: [P + "bath-before.webp"], afterPhotos: [P + "bath-after.webp"],
      before: P + "bath-before.webp", after: P + "bath-after.webp" },
    { id: "s3", type: "주방", title: "주방·아일랜드 교체", area: "24평", tags: ["싱크대", "상판", "조명"],
      beforePhotos: [P + "kitchen-before.webp"], afterPhotos: [P + "kitchen-after.webp"],
      before: P + "kitchen-before.webp", after: P + "kitchen-after.webp" },
  ],
  reviewList: [
    { id: "sr1", rating: 5, space_type: "아파트 전체", user_name: "예시 후기",
      content: "실제 후기는 공사를 마친 의뢰인만 남길 수 있어요. 이런 식으로 사진과 함께 보여요." },
    { id: "sr2", rating: 5, space_type: "욕실", user_name: "예시 후기",
      content: "상담이 빨랐고 일정 안내가 꼼꼼했어요 — 같은 방식으로 별점·공간 유형이 함께 표시됩니다." },
  ],
};

/** 실제 업체가 적을 때만 목록 끝에 견본을 붙인다(많아지면 자연히 사라짐). */
export const SAMPLE_WHEN_FEWER_THAN = 3;
