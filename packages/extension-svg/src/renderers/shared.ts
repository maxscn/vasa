import { parseSvgPathData, parseSvgViewBox } from "@skriva/renderer";

export type SvgPathSpec = {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export function svgPathsFromProps(
  props: Record<string, unknown> | undefined,
  rect: { width: number; height: number },
) {
  const paths = Array.isArray(props?.paths) ? props.paths : [];
  const width = typeof props?.width === "number" ? props.width : rect.width;
  const height = typeof props?.height === "number" ? props.height : rect.height;
  const viewBox = parseSvgViewBox(
    typeof props?.viewBox === "string" ? props.viewBox : undefined,
    width,
    height,
  );

  return paths.flatMap((path) => {
    if (!isSvgPathSpec(path)) return [];

    return [
      {
        path: parseSvgPathData(path.d),
        viewBox,
        fill: path.fill,
        stroke: path.stroke,
        strokeWidth: path.strokeWidth,
      },
    ];
  });
}

function isSvgPathSpec(value: unknown): value is SvgPathSpec {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as { d?: unknown }).d === "string";
}
