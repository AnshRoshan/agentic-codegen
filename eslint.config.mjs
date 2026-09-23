import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      // The app intentionally fetches/polls API state in mount effects; rewriting
      // every call site to the newer React Compiler patterns is churn, not value.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
