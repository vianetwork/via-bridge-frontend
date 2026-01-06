import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintPluginTs from "@typescript-eslint/eslint-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "**/.turbo/**",
      "**/.cache/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
      "**/coverage/**",
      "**/.env*",
    ],
  },
  {
    plugins: {
      '@typescript-eslint': eslintPluginTs,
    },
    rules: {
      'semi': ['error', 'always'],
      'semi-style': ['error', 'last'],
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
];

export default eslintConfig;
