export const pagePresets = {
  a4: { label: "A4", width: 695, height: 842, note: "210 x 297 mm" },
  letter: { label: "Letter", width: 712, height: 792, note: "8.5 x 11 in" },
  legal: { label: "Legal", width: 712, height: 1008, note: "8.5 x 14 in" },
} as const;

export type PagePresetId = keyof typeof pagePresets;

export const marginPresets = {
  compact: { label: "Compact", value: 36 },
  normal: { label: "Normal", value: 56 },
  wide: { label: "Wide", value: 72 },
} as const;

export type MarginPresetId = keyof typeof marginPresets;
