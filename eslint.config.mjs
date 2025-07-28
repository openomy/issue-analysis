import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // 先继承 Next.js 的配置
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // 再加一段自定义配置，把 no-explicit-any 关掉
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];