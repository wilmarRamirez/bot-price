import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      js,
    },
    extends: ["js/recommended"],
    rules: {
      "max-statements": ["warn", 10],
      "max-lines-per-function": ["warn", 50],
      complexity: ["warn", 6],
      "capitalized-comments": [
        "warn",
        "always",
        {
          ignorePattern: "pragma|ignored",
          ignoreInlineComments: true,
          ignoreConsecutiveComments: true,
        },
      ],
    },
  },
]);
