import globals from "globals"
import js from "@eslint/js"

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      },
      ecmaVersion: 2022,
      sourceType: "module"
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error"
    }
  },
  {
    ignores: ["dist/", "node_modules/", "examples/three.*"]
  }
]
