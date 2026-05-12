export function ToggleField({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="switch-field">
      <span>{label}</span>
      <button
        aria-checked={checked}
        aria-label={label}
        className="switch-control"
        data-state={checked ? "checked" : "unchecked"}
        onClick={() => onCheckedChange(!checked)}
        role="switch"
        type="button"
      >
        <span />
      </button>
    </div>
  );
}
