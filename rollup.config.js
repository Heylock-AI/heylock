import { terser } from "rollup-plugin-terser";

export default {
  input: "index.js",
  output: {
    file: "dist/heylock.min.js",
    format: "esm",
    sourcemap: true
  },
  plugins: [terser()]
};
