import { COMPANIES } from "./mockCompanies";

export const REQUESTS = [
  { id:1, user:"김**", area:"마포구 합정동", size:"32평", type:"아파트 전체", budget:"2,500~3,000만원", style:"모던 미니멀", desc:"신혼집 전체 리모델링. 주방 확장, 욕실 2개 교체 원합니다.", bids:4, time:"2시간 전", distance:"1.2km", urgent:false },
  { id:2, user:"박**", area:"마포구 망원동", size:"12평", type:"원룸", budget:"500~800만원", style:"북유럽", desc:"원룸 부분 인테리어. 도배, 바닥재, 조명 교체.", bids:2, time:"4시간 전", distance:"0.8km", urgent:false },
  { id:3, user:"이**", area:"서대문구 연남동", size:"8평", type:"카페/식당", budget:"3,000~4,000만원", style:"인더스트리얼", desc:"카페 오픈 준비. 인더스트리얼 콘셉트 전체 시공.", bids:6, time:"1일 전", distance:"2.1km", urgent:true },
];

export const MOCK_BIDS = [
  { id:1, requestId:1, company:COMPANIES[0], price:2650, period:35, material:"LX하우시스 바닥재, 대림 욕실", comment:"에스크로 156건 완료. 중간 점검 사진 매번 공유드립니다.", createdAt:"", status:"pending" },
  { id:2, requestId:1, company:COMPANIES[1], price:2480, period:30, material:"동화 바닥재, 아메리칸스탠다드 욕실", comment:"미니멀 감성 전문. 일정 준수 보장합니다.", createdAt:"", status:"pending" },
  { id:3, requestId:1, company:COMPANIES[2], price:2200, period:40, material:"국산 중급 자재", comment:"합리적인 가격으로 최선을 다하겠습니다.", createdAt:"", status:"pending" },
];
