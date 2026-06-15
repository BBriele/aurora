import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    file: "../custom_components/aurora/www/aurora-card.js",
    format: "es",
    inlineDynamicImports: true,
  },
  plugins: [resolve(), typescript({ tsconfig: "./tsconfig.json" })],
};
