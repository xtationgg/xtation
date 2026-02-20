import React from 'react';

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'static';

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  value: string;
  placeholder?: string;
  options?: string[];
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export const ChallengeFields: React.FC<{ fields: FieldConfig[] }> = ({ fields }) => {
  return (
    <div className="grid gap-2">
      {fields.map((field) => (
        <label
          key={field.key}
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-1 flex flex-col gap-1"
        >
          <span className="text-[8px] uppercase tracking-[0.22em] text-[#8b847a]">{field.label}</span>
          {field.type === 'static' ? (
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#f3f0e8]">{field.value}</span>
          ) : field.type === 'select' ? (
            <select
              value={field.value}
              disabled={field.disabled}
              onChange={(event) => field.onChange?.(event.target.value)}
              className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[#f3f0e8] focus:outline-none"
            >
              {field.options?.map((option) => (
                <option key={option} value={option} className="text-black">
                  {option}
                </option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              rows={2}
              value={field.value}
              disabled={field.disabled}
              placeholder={field.placeholder}
              onChange={(event) => field.onChange?.(event.target.value)}
              className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[#f3f0e8] placeholder:text-[#5e5850] focus:outline-none resize-none"
            />
          ) : (
            <input
              type={field.type}
              value={field.value}
              disabled={field.disabled}
              placeholder={field.placeholder}
              onChange={(event) => field.onChange?.(event.target.value)}
              className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[#f3f0e8] placeholder:text-[#5e5850] focus:outline-none"
            />
          )}
        </label>
      ))}
    </div>
  );
};
