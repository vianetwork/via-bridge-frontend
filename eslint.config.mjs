import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintPluginTs from "@typescript-eslint/eslint-plugin"; // ✅ Fix: Add this line

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      '@typescript-eslint': eslintPluginTs,
    },
    rules: {
      'semi': ['error', 'always'],
      'semi-style': ['error', 'last'],
      '@typescript-eslint/no-explicit-any': 'off' // ✅ Rule now correctly recognized
    }
  }
];

export default eslintConfig;
