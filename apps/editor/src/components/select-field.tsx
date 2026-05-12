import { Check, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

type SelectFieldOption = {
  label: string;
  value: string;
};

export function SelectField({
  ariaLabel,
  className,
  icon,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  icon?: ReactNode;
  onValueChange: (value: string) => void;
  options: SelectFieldOption[];
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className={className === undefined ? "ui-select" : `ui-select ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="ui-select-trigger"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        {icon}
        <span className="ui-select-value">{selectedOption?.label}</span>
        <ChevronDown className="ui-select-chevron" size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="ui-select-content" role="listbox" aria-label={ariaLabel} tabIndex={-1}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="ui-select-item"
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
            >
              <Check className="ui-select-check" size={14} aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
