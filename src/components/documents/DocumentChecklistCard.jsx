// src/components/documents/DocumentChecklistCard.jsx

import { useState } from "react";

export default function DocumentChecklistCard({ template, initialData, onSave, onSubmit }) {
  const [checkedItems, setCheckedItems] = useState(
    initialData?.checklist ||
      template.checklist.map((label) => ({ label, checked: false }))
  );
  const [consentChecked, setConsentChecked] = useState(
    initialData?.consent_checked || false
  );
  const [formData, setFormData] = useState(initialData?.form_data || {});

  const allRequiredChecked =
    checkedItems.every((item) => item.checked) && consentChecked;

  const toggleCheck = (index) => {
    setCheckedItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const payload = {
    document_type: template.type,
    title: template.title,
    form_data: formData,
    checklist: checkedItems,
    consent_checked: consentChecked
  };

  return (
    <div className="rounded-2xl border border-[#E5DED2] bg-white p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm text-[#C8A15A]">{template.required ? "필수" : "선택"}</p>
        <h3 className="text-lg font-bold text-[#2E5F4B]">{template.title}</h3>
        <p className="mt-1 text-sm text-gray-600">{template.description}</p>
      </div>

      {template.reason && (
        <div className="mb-4 rounded-xl bg-[#F5F1EA] p-3 text-sm text-gray-700">
          <strong>필요한 이유</strong>
          <p className="mt-1">{template.reason}</p>
        </div>
      )}

      {template.sections?.map((section) => (
        <div key={section.title} className="mb-4">
          <h4 className="mb-1 font-semibold text-[#1F2A24]">{section.title}</h4>
          <p className="text-sm leading-6 text-gray-700">{section.body}</p>
        </div>
      ))}

      {template.fields?.map((field) => (
        <label key={field.key} className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            {field.label}{" "}
            {field.required && <span className="text-red-500">*</span>}
          </span>

          {field.type === "textarea" ? (
            <textarea
              className="w-full rounded-xl border border-gray-200 p-3 text-sm"
              value={formData[field.key] || ""}
              onChange={(e) =>
                setFormData({ ...formData, [field.key]: e.target.value })
              }
            />
          ) : field.type === "select" ? (
            <select
              className="w-full rounded-xl border border-gray-200 p-3 text-sm"
              value={formData[field.key] || ""}
              onChange={(e) =>
                setFormData({ ...formData, [field.key]: e.target.value })
              }
            >
              <option value="">선택</option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm"
              value={formData[field.key] || ""}
              onChange={(e) =>
                setFormData({ ...formData, [field.key]: e.target.value })
              }
            />
          )}
        </label>
      ))}

      <div className="space-y-2">
        {checkedItems.map((item, index) => (
          <label key={index} className="flex gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => toggleCheck(index)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      <label className="mt-4 flex gap-2 rounded-xl bg-[#F5F1EA] p-3 text-sm font-medium text-[#2E5F4B]">
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={() => setConsentChecked(!consentChecked)}
        />
        <span>{template.consentText}</span>
      </label>

      <div className="mt-4 flex gap-2">
        <button
          className="h-12 flex-1 rounded-full border border-[#2E5F4B] text-[#2E5F4B]"
          onClick={() => onSave({ ...payload, status: "draft" })}
        >
          저장
        </button>

        <button
          disabled={!allRequiredChecked}
          className="h-12 flex-1 rounded-full bg-[#2E5F4B] text-white disabled:opacity-40"
          onClick={() => onSubmit({ ...payload, status: "submitted" })}
        >
          제출
        </button>
      </div>
    </div>
  );
}
