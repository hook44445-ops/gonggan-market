export const DOCUMENT_TEMPLATES = [
  {
    type: "service_terms",
    title: "서비스 이용약관",
    required: true,
    target: "all",
    description: "공간마켓 서비스 이용을 위한 기본 약관입니다.",
    reason: "고객과 업체가 안전하게 서비스를 이용하기 위한 기본 기준입니다.",
    sections: [
      {
        title: "서비스 성격",
        body: "공간마켓은 고객과 업체가 견적, 상담, 계약, 공사 진행, 정산을 보다 안전하게 관리할 수 있도록 돕는 중개 플랫폼입니다. 공간마켓은 직접 시공을 수행하지 않으며, 실제 시공 계약과 이행은 고객과 업체 간 합의에 따라 진행됩니다."
      },
      {
        title: "기록 기반 거래",
        body: "공간마켓은 거래 과정에서 견적 내용, 계약 범위, 사진, 대화, 단계 승인 내역 등을 기록하여 분쟁 예방과 확인 자료로 활용할 수 있습니다."
      }
    ],
    checklist: [
      "공간마켓은 고객과 업체를 연결하는 중개 플랫폼임을 확인했습니다.",
      "실제 시공 품질과 계약 이행은 고객과 업체 간 합의에 따라 진행됨을 확인했습니다.",
      "허위 정보, 허위 견적, 악의적 리뷰, 부정 이용을 하지 않겠습니다.",
      "분쟁 발생 시 플랫폼의 기록이 확인 자료로 활용될 수 있음에 동의합니다."
    ],
    consentText: "위 내용을 확인했으며, 공간마켓 서비스 이용약관에 동의합니다."
  },
  {
    type: "privacy_policy",
    title: "개인정보 수집 및 이용 동의",
    required: true,
    target: "all",
    description: "서비스 이용, 견적, 상담, 계약, 정산을 위한 개인정보 수집 동의입니다.",
    reason: "회원 식별, 거래 진행, 고객지원, 분쟁 처리를 위해 필요합니다.",
    sections: [
      {
        title: "수집 항목",
        body: "이름 또는 닉네임, 전화번호, 지역 정보, 견적 요청 내용, 상담 및 거래 기록, 업로드한 서류 및 이미지, 결제 및 정산 관련 정보가 수집될 수 있습니다."
      },
      {
        title: "이용 목적",
        body: "회원 식별, 로그인, 견적 요청, 업체 상담, 계약 진행, 업체 심사, 분쟁 처리, 고객지원, 서비스 품질 개선을 위해 사용됩니다."
      }
    ],
    checklist: [
      "개인정보 수집 및 이용 목적을 확인했습니다.",
      "서비스 이용을 위해 필요한 정보가 저장될 수 있음에 동의합니다.",
      "분쟁 및 고객지원 처리를 위해 거래 기록이 보관될 수 있음에 동의합니다."
    ],
    consentText: "위 내용을 확인했으며, 개인정보 수집 및 이용에 동의합니다."
  },
  {
    type: "location_terms",
    title: "위치기반서비스 이용 동의",
    required: true,
    target: "all",
    description: "지역 기반 업체 추천과 주변 업체 조회를 위한 동의입니다.",
    reason: "내 위치 또는 선택 지역 기준으로 적합한 업체를 추천하기 위해 필요합니다.",
    sections: [
      {
        title: "위치 정보 사용",
        body: "공간마켓은 주변 업체 추천, 시공 가능 지역 확인, 지역 기반 검색을 위해 위치 정보 또는 사용자가 선택한 지역 정보를 사용할 수 있습니다."
      }
    ],
    checklist: [
      "내 위치 또는 선택한 지역을 기준으로 업체가 추천될 수 있음을 확인했습니다.",
      "현재 위치 사용을 거부해도 직접 지역을 선택해 서비스를 이용할 수 있음을 확인했습니다.",
      "위치 정보는 지역 기반 서비스 제공 목적으로 사용됩니다."
    ],
    consentText: "위 내용을 확인했으며, 위치기반서비스 이용에 동의합니다."
  },
  {
    type: "customer_transaction_notice",
    title: "고객 거래 유의사항",
    required: true,
    target: "customer",
    description: "의뢰인이 안전하게 거래하기 위해 확인해야 할 내용입니다.",
    reason: "요청 내용, 계약 범위, 단계 승인 기준을 명확히 하기 위해 필요합니다.",
    sections: [
      {
        title: "거래 전 확인",
        body: "고객은 시공 전 공사 범위, 금액, 일정, 포함 항목과 제외 항목을 확인해야 합니다. 추가 요청이 발생하는 경우 업체와 사전 합의 후 진행해야 합니다."
      },
      {
        title: "단계 승인",
        body: "착공, 중간점검, 완료 단계에서 사진과 진행 내용을 확인한 뒤 승인해야 하며, 문제가 있는 경우 승인하지 않고 보류 또는 분쟁 접수를 진행할 수 있습니다."
      }
    ],
    checklist: [
      "견적 요청 시 허위 정보나 과장된 내용을 입력하지 않겠습니다.",
      "시공 전 계약 범위와 금액, 일정, 포함/제외 항목을 확인하겠습니다.",
      "추가 요청은 업체와 사전 합의 후 진행해야 함을 확인했습니다.",
      "단계 승인 전 사진과 진행 내용을 확인하겠습니다.",
      "분쟁 발생 시 기록된 자료가 판단 기준으로 활용될 수 있음에 동의합니다."
    ],
    consentText: "위 내용을 확인했으며, 고객 거래 유의사항에 동의합니다."
  },
  {
    type: "operation_pledge",
    title: "업체 운영 준수서약",
    required: true,
    target: "company",
    description: "공간마켓 입점 업체가 지켜야 할 운영 기준입니다.",
    reason: "고객 신뢰와 플랫폼 거래 안정성을 유지하기 위해 필요합니다.",
    sections: [
      {
        title: "업체 운영 기준",
        body: "업체는 허위 견적, 무단 추가금 요구, 고객 정보 유출, 기록 누락 등 고객 신뢰를 훼손하는 행위를 해서는 안 됩니다."
      }
    ],
    checklist: [
      "허위 견적을 제공하지 않겠습니다.",
      "계약 전 공사 범위, 금액, 일정, 자재 내용을 명확히 안내하겠습니다.",
      "고객 동의 없이 추가금을 요구하지 않겠습니다.",
      "시공 전후 사진과 단계별 진행 기록을 성실히 남기겠습니다.",
      "고객 개인정보를 외부에 유출하지 않겠습니다.",
      "분쟁 발생 시 공간마켓의 확인 및 중재 절차에 협조하겠습니다.",
      "허위 정보 제출 시 배지 취소 및 제재가 가능함을 확인했습니다."
    ],
    consentText: "위 내용을 확인했으며, 공간마켓 업체 운영 기준을 준수하겠습니다."
  },
  {
    type: "escrow_agreement",
    title: "에스크로 및 정산 동의서",
    required: true,
    target: "company",
    description: "단계별 정산 구조와 보류 기준에 대한 동의서입니다.",
    reason: "고객과 업체 모두 안전하게 거래하기 위한 정산 기준입니다.",
    sections: [
      {
        title: "정산 구조",
        body: "공간마켓은 계약 완료 후 10%, 착공 확인 후 20%, 중간점검 후 40%, 완료 확인 후 30%의 단계별 정산 구조를 기준으로 합니다."
      },
      {
        title: "정산 보류",
        body: "분쟁이 발생하거나 단계 승인에 문제가 있는 경우 정산은 보류될 수 있으며, 관리자 확인 후 상태가 변경됩니다."
      }
    ],
    checklist: [
      "정산은 고객의 단계별 확인과 플랫폼 기록을 기준으로 진행됨을 확인했습니다.",
      "분쟁 발생 시 정산이 보류될 수 있음을 확인했습니다.",
      "지급 보류, 수동 지급 완료, 정산 상태 변경은 관리자 확인 후 처리될 수 있음을 확인했습니다.",
      "실제 송금 또는 환불은 플랫폼 정책과 관리자 검토 절차에 따라 처리됩니다."
    ],
    consentText: "위 내용을 확인했으며, 공간마켓 에스크로 및 정산 구조에 동의합니다."
  },
  {
    type: "badge_application",
    title: "공간보증 배지 신청서",
    required: false,
    target: "company",
    description: "공간보증 배지 심사를 위한 신청서입니다.",
    reason: "업체의 신뢰도, 서류, 보험, 시공 가능 범위를 확인하기 위해 필요합니다.",
    fields: [
      { key: "companyName", label: "업체명", type: "text", required: true },
      { key: "ownerName", label: "대표자명", type: "text", required: true },
      { key: "managerPhone", label: "담당자 연락처", type: "text", required: true },
      { key: "serviceRegion", label: "운영 가능 지역", type: "text", required: true },
      { key: "badgeTier", label: "신청 배지 등급", type: "select", options: ["Basic", "Standard", "Premium", "Enterprise", "Signature"], required: true },
      { key: "availableAmount", label: "가능 공사 금액", type: "number", required: true },
      { key: "hasInsurance", label: "보험 보유 여부", type: "boolean", required: true },
      { key: "recentWorks", label: "최근 시공 사례", type: "textarea", required: false }
    ],
    checklist: [
      "제출한 정보가 사실임을 확인합니다.",
      "허위 정보 제출 시 배지 취소 및 업체 제재가 가능함에 동의합니다.",
      "공간마켓의 심사 기준에 따라 승인, 보류, 반려될 수 있음을 확인했습니다."
    ],
    consentText: "위 내용을 확인했으며, 공간보증 배지 심사를 신청합니다."
  },
  {
    type: "contract_scope_confirmation",
    title: "계약 범위 확인서",
    required: true,
    target: "all",
    description: "공사 전 계약 범위를 명확히 기록하는 확인서입니다.",
    reason: "말이 달랐다는 분쟁을 줄이기 위해 필요합니다.",
    fields: [
      { key: "projectName", label: "공사명", type: "text", required: true },
      { key: "projectAddress", label: "공사 장소", type: "text", required: true },
      { key: "totalAmount", label: "총 공사 금액", type: "number", required: true },
      { key: "duration", label: "예상 공사 기간", type: "text", required: true },
      { key: "includedWorks", label: "포함 공정", type: "textarea", required: true },
      { key: "excludedWorks", label: "제외 공정", type: "textarea", required: true },
      { key: "materials", label: "사용 자재", type: "textarea", required: false },
      { key: "changeOrderCondition", label: "추가금 발생 조건", type: "textarea", required: false }
    ],
    checklist: [
      "계약 범위와 포함/제외 항목을 확인했습니다.",
      "추가 작업은 별도 합의 후 진행해야 함을 확인했습니다.",
      "계약 범위 외 작업은 추가금이 발생할 수 있음을 확인했습니다.",
      "본 확인서는 분쟁 발생 시 기준 자료로 활용될 수 있음에 동의합니다."
    ],
    consentText: "위 계약 범위를 확인했으며, 해당 내용에 동의합니다."
  },
  {
    type: "phase_approval_confirmation",
    title: "단계별 승인 확인서",
    required: true,
    target: "customer",
    description: "공사 진행 단계별 승인과 정산을 연결하는 확인서입니다.",
    reason: "사진과 진행 내용을 확인한 뒤 단계별 정산이 진행되도록 하기 위해 필요합니다.",
    fields: [
      { key: "phase", label: "승인 단계", type: "select", options: ["착공 확인", "중간점검 확인", "완료 확인"], required: true },
      { key: "memo", label: "확인 메모", type: "textarea", required: false }
    ],
    checklist: [
      "업체가 업로드한 단계별 사진과 내용을 확인했습니다.",
      "현재 단계가 정상적으로 진행되었음을 확인합니다.",
      "승인 후 해당 단계의 정산 상태가 변경될 수 있음을 확인했습니다.",
      "문제가 있는 경우 승인하지 않고 보류 또는 분쟁 접수를 진행해야 함을 확인했습니다."
    ],
    consentText: "현재 단계의 진행 내용을 확인했으며, 단계 승인에 동의합니다."
  },
  {
    type: "lounge_policy",
    title: "라운지 운영정책",
    required: true,
    target: "all",
    description: "익명 라운지를 안전하게 이용하기 위한 운영정책입니다.",
    reason: "자유로운 소통과 안전한 커뮤니티 운영을 함께 유지하기 위해 필요합니다.",
    sections: [
      {
        title: "라운지 기본 원칙",
        body: "라운지는 익명 기반으로 자유롭게 이야기할 수 있는 공간이지만, 욕설, 비방, 성희롱, 허위 정보, 과도한 광고, 개인정보 노출은 제한됩니다."
      }
    ],
    checklist: [
      "욕설, 비방, 성희롱, 혐오 표현을 작성하지 않겠습니다.",
      "허위 정보, 사기성 글, 과도한 광고글을 작성하지 않겠습니다.",
      "타인의 개인정보를 공개하지 않겠습니다.",
      "운영정책 위반 시 글 숨김, 활동 제한, 이용 제재가 가능함을 확인했습니다.",
      "익명으로 작성하더라도 관리자 확인이 필요한 경우 실제 userId 기준으로 조치될 수 있음을 확인했습니다."
    ],
    consentText: "위 내용을 확인했으며, 라운지 운영정책에 동의합니다."
  },
  {
    type: "chat_policy",
    title: "대화 연결 정책",
    required: true,
    target: "all",
    description: "라운지 대화 신청과 토큰 차감 기준에 대한 정책입니다.",
    reason: "무분별한 대화 신청을 줄이고 실제 연결 의사를 확인하기 위해 필요합니다.",
    sections: [
      {
        title: "대화 신청",
        body: "대화 신청은 상대방이 수락해야 연결됩니다. 신청 시에는 토큰이 차감되지 않으며, 상대방이 수락한 경우에만 공간토큰이 차감됩니다."
      }
    ],
    checklist: [
      "대화 신청은 상대방이 수락해야 연결됨을 확인했습니다.",
      "상대방이 수락한 경우에만 공간토큰이 차감됨을 확인했습니다.",
      "상대방이 거절하면 토큰이 차감되지 않음을 확인했습니다.",
      "욕설, 불쾌한 대화, 영업성 도배, 사기성 접근 시 신고 및 제한될 수 있음을 확인했습니다."
    ],
    consentText: "위 내용을 확인했으며, 대화 연결 정책에 동의합니다."
  },
  {
    type: "report_block_policy",
    title: "신고 및 차단 정책",
    required: true,
    target: "all",
    description: "안전한 거래와 커뮤니티 이용을 위한 신고/차단 정책입니다.",
    reason: "부적절한 활동을 줄이고 사용자 보호를 위해 필요합니다.",
    sections: [
      {
        title: "신고 사유",
        body: "욕설/비방, 허위 정보, 사기 의심, 성희롱/불쾌한 대화, 도배/광고, 거래 방해, 기타 운영정책 위반 행위는 신고 대상이 될 수 있습니다."
      }
    ],
    checklist: [
      "신고 접수 시 관리자 검토가 진행될 수 있음을 확인했습니다.",
      "허위 신고를 반복할 경우 제재될 수 있음을 확인했습니다.",
      "차단한 사용자의 글, 댓글, 스토리, 대화 신청이 제한될 수 있음을 확인했습니다."
    ],
    consentText: "위 내용을 확인했으며, 신고/차단 정책에 동의합니다."
  }
];

export const UPLOAD_DOCUMENT_TEMPLATES = [
  {
    type: "business_license",
    title: "사업자등록증",
    required: true,
    target: "company",
    description: "사업자 정보 확인을 위한 필수 서류입니다.",
    reason: "업체명, 대표자명, 사업자등록번호, 사업장 주소를 확인하기 위해 필요합니다.",
    allowedTypes: ["application/pdf", "image/jpeg", "image/png", "image/heic"],
    maxSizeMB: 10,
    checklist: [
      "상호명, 사업자등록번호, 대표자명, 사업장 주소가 확인됩니다.",
      "흐릿하거나 잘린 이미지는 보류될 수 있음을 확인했습니다.",
      "제출한 사업자등록증이 실제 사업자 정보와 일치함을 확인합니다.",
      "허위 서류 제출 시 승인 취소 및 이용 제한이 가능함에 동의합니다."
    ]
  },
  {
    type: "insurance_certificate",
    title: "시공보험증서",
    required: true,
    target: "company",
    description: "시공 중 발생할 수 있는 사고나 손해에 대비하기 위한 보험 확인 서류입니다.",
    reason: "공간보증 및 안전한 거래 심사를 위해 필요합니다.",
    allowedTypes: ["application/pdf", "image/jpeg", "image/png", "image/heic"],
    maxSizeMB: 10,
    checklist: [
      "보험사명, 가입 업체명, 보장 기간, 보장 금액, 보험증권번호가 확인됩니다.",
      "만료된 보험증서는 승인되지 않을 수 있음을 확인했습니다.",
      "제출한 보험증서가 현재 유효한 서류임을 확인합니다.",
      "보험 만료 또는 허위 제출 시 배지 취소 및 이용 제한이 가능함에 동의합니다."
    ]
  },
  {
    type: "bankbook_copy",
    title: "통장사본",
    required: false,
    target: "company",
    description: "정산 계좌 확인을 위한 서류입니다.",
    reason: "수동 정산 또는 정산 정보 확인을 위해 필요할 수 있습니다.",
    allowedTypes: ["application/pdf", "image/jpeg", "image/png", "image/heic"],
    maxSizeMB: 10,
    checklist: [
      "예금주명, 은행명, 계좌번호가 확인됩니다.",
      "정산 계좌 정보가 업체 정보와 일치함을 확인합니다.",
      "잘못된 계좌 정보로 정산이 지연될 수 있음을 확인했습니다."
    ]
  },
  {
    type: "qualification_license",
    title: "자격증/면허증",
    required: false,
    target: "company",
    description: "전문 분야 또는 자격 보유 여부를 확인하기 위한 선택 서류입니다.",
    reason: "업체 신뢰도와 전문성을 확인하는 자료로 활용됩니다.",
    allowedTypes: ["application/pdf", "image/jpeg", "image/png", "image/heic"],
    maxSizeMB: 10,
    checklist: [
      "이름, 자격명, 발급기관, 발급일자가 확인됩니다.",
      "제출한 자격증/면허증이 사실임을 확인합니다.",
      "허위 제출 시 승인 취소 및 이용 제한이 가능함에 동의합니다."
    ]
  },
  {
    type: "portfolio",
    title: "포트폴리오/시공사진",
    required: false,
    target: "company",
    description: "업체의 실제 시공 경험을 확인하기 위한 자료입니다.",
    reason: "고객이 업체를 신뢰하고 비교할 수 있도록 돕는 자료입니다.",
    allowedTypes: ["image/jpeg", "image/png", "image/heic", "application/pdf"],
    maxSizeMB: 10,
    checklist: [
      "실제 시공 사례를 확인할 수 있는 자료를 업로드합니다.",
      "직접 시공했거나 사용 권한이 있는 사진만 제출합니다.",
      "타인의 사진을 무단 사용하지 않겠습니다."
    ]
  }
];
