import { useEffect, useState } from "react";
import { docObjectRef, signedDocUrl, PRIVATE_DOC_BUCKETS } from "../lib/supabase";

// 공사·현장·견적 사진 표시용 <img>.
// #693 이후 documents 버킷에 올린 사진은 «버킷/경로»(예: "documents/escrow/3/…jpg")로 저장된다.
// 이 값을 그대로 src 에 넣으면 깨진 그림이 되므로, 비공개 서류 버킷이면 볼 때마다 서명 주소로 바꾼다.
// 일반 공개 주소(포트폴리오·채팅 사진 등)는 그대로 쓴다.
export default function DocImg({ src, style, ...rest }) {
  const ref = docObjectRef(src);
  const needSign = !!ref && PRIVATE_DOC_BUCKETS.includes(ref.bucket);
  const [url, setUrl] = useState(needSign ? null : src);

  useEffect(() => {
    if (!needSign) { setUrl(src); return undefined; }
    let alive = true;
    setUrl(null);
    signedDocUrl(src).then((u) => { if (alive) setUrl(u); }).catch(() => { if (alive) setUrl(src); });
    return () => { alive = false; };
  }, [src, needSign]);

  if (!url) return <span aria-hidden style={{ display: "block", background: "#EEE9DF", ...style }} />;
  return <img src={url} style={style} {...rest} />;
}
