// src/components/documents/DocumentUploadCard.jsx

import { useState } from "react";

export default function DocumentUploadCard({ template, onSubmit }) {
  const [file, setFile] = useState(null);
  const [checkedItems, setCheckedItems] = useState(
    template.checklist.map((label) => ({ label, checked: false }))
  );

  const allChecked = checkedItems.every((item) => item.checked);

  const toggleCheck = (index) => {
    setCheckedItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  };

  return (
    <div className="rounded-2xl border border-[#E5DED2] bg-white p-4 shadow-sm">
      <p className="text-sm text-[#C8A15A]">{template.required ? "필수" : "선택"}</p>
      <h3 className="text-lg font-bold text-[#2E5F4B]">{template.title}</h3>
      <p className="mt-1 text-sm text-gray-600">{template.description}</p>

      <div className="my-4 rounded-xl bg-[#F5F1EA] p-3 text-sm text-gray-700">
        {template.reason}
      </div>

      <input
        type="file"
        accept={template.allowedTypes.join(",")}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-3 w-full rounded-xl border border-gray-200 p-3 text-sm"
      />

      {file && (
        <div className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-[#2E5F4B]">
          {file.name} ✅
        </div>
      )}

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

      <button
        disabled={!file || !allChecked}
        className="mt-4 h-12 w-full rounded-full bg-[#2E5F4B] text-white disabled:opacity-40"
        onClick={() => onSubmit({ template, file, checklist: checkedItems })}
      >
        업로드 후 제출
      </button>
    </div>
  );
}
