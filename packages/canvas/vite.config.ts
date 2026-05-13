import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      box: "src/box.ts",
      commands: "src/commands/index.ts",
      document: "src/document.ts",
      index: "src/index.ts",
      primitives: "src/primitives.ts",
      text: "src/text.ts",
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
