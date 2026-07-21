import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      canvas: "canvas.ts",
      enrichment: "enrichment.ts",
      "enrichments/horizontal-rule": "enrichments/horizontal-rule.ts",
      "enrichments/line-height": "enrichments/line-height.ts",
      "enrichments/starter": "enrichments/starter.ts",
      "enrichments/svg": "enrichments/svg.ts",
      "enrichments/table": "enrichments/table.ts",
      "editor/react": "react.ts",
      font: "font.ts",
      headless: "headless.ts",
      index: "src/index.ts",
      layout: "layout.ts",
      pdf: "pdf.ts",
      scene: "scene.ts",
    },
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
