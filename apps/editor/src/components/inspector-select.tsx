import { SelectField } from "./select-field";

export function InspectorSelect({
  ariaLabel,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <SelectField
      ariaLabel={ariaLabel}
      className="select-field"
      onValueChange={onValueChange}
      options={options}
      value={value}
    />
  );
}
