import type { Rect } from "@skriva/layout";

export function horizontalRulePath(
  rect: Rect,
  props: Record<string, unknown> | undefined,
  yOffset = 0,
): {
  commands: Array<
    | { type: "moveTo"; x: number; y: number }
    | { type: "lineTo"; x: number; y: number }
    | { type: "closePath" }
  >;
} {
  const rule = horizontalRuleRect(rect, props, yOffset);

  return {
    commands: [
      { type: "moveTo", x: rule.x, y: rule.y },
      { type: "lineTo", x: rule.x + rule.width, y: rule.y },
      { type: "lineTo", x: rule.x + rule.width, y: rule.y + rule.height },
      { type: "lineTo", x: rule.x, y: rule.y + rule.height },
      { type: "closePath" },
    ],
  };
}

export function horizontalRuleRect(
  rect: Rect,
  props: Record<string, unknown> | undefined,
  yOffset = 0,
): Rect {
  const thickness = horizontalRuleThickness(props);
  const y = rect.y + yOffset + Math.max(0, Math.floor((rect.height - thickness) / 2));

  return {
    x: rect.x,
    y,
    width: rect.width,
    height: thickness,
  };
}

export function horizontalRuleColor(props: Record<string, unknown> | undefined) {
  return typeof props?.color === "string" ? props.color : "#d1d5db";
}

export function horizontalRuleThickness(props: Record<string, unknown> | undefined) {
  return typeof props?.thickness === "number" ? Math.max(1, props.thickness) : 1;
}
