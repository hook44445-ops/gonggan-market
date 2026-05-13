import { C, R } from "../../constants";

const META = {
  platform: { t:"공간마켓 인증", c:C.navy,  bg:C.navyL,  i:"🛡" },
  insurance:{ t:"시공보험 가입", c:C.green, bg:C.greenL, i:"🔒" },
  biz:      { t:"사업자 등록",   c:C.text3, bg:C.bgWarm, i:"📋" },
};

export default function CertBadge({ type }) {
  const b = META[type];
  if (!b) return null;
  return (
    <span style={{ background:b.bg, color:b.c, borderRadius:R.full,
      padding:"2px 9px", fontSize:11, fontWeight:700,
      display:"inline-flex", alignItems:"center", gap:3 }}>
      {b.i} {b.t}
    </span>
  );
}
