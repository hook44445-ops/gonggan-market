// src/services/documentService.js
// 에스크로는 플랫폼 수익 구조가 아닌 신뢰 인프라입니다.
// 서류 시스템도 마찬가지: 규제가 아닌 신뢰 기록입니다.

import { supabase } from "../lib/supabase";

export async function saveDocumentDraft(payload) {
  const { data, error } = await supabase
    .from("company_documents")
    .upsert(
      {
        ...payload,
        status: "draft",
        updated_at: new Date().toISOString()
      },
      { onConflict: "company_id,document_type" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function submitDocument(payload) {
  const { data, error } = await supabase
    .from("company_documents")
    .upsert(
      {
        ...payload,
        status: "submitted",
        review_status: "pending",
        updated_at: new Date().toISOString()
      },
      { onConflict: "company_id,document_type" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadDocumentFile({ file, companyId, userId, documentType }) {
  const ext = file.name.split(".").pop();
  const path = `${companyId}/${documentType}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("company-documents")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (uploadError) throw uploadError;

  // 공개 주소를 만들지 않는다 — «버킷/경로» 만 저장하고, 볼 때 서명 주소를 만든다(signedDocUrl).
  return {
    file_name: file.name,
    file_url: `company-documents/${path}`,
    file_size: file.size,
    mime_type: file.type
  };
}
