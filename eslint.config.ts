import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import type { Linter } from "eslint";

const sharedRules: Linter.RulesRecord = {
  ...tsPlugin.configs!.recommended!.rules,
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "@typescript-eslint/no-explicit-any": "warn",
};

const config: Linter.Config[] = [
  {
    ignores: ["node_modules/**", "dist/**", "_site/**", "temp/**"],
  },

  // --- Site scripts (browser) ---
  {
    files: ["site/scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser as Linter.Parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        document: "readonly",
        window: "readonly",
        location: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLAnchorElement: "readonly",
        MouseEvent: "readonly",
        IntersectionObserverEntry: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin as Record<string, unknown>,
    },
    rules: sharedRules,
  },

  // --- GAS server (Apps Script runtime) ---
  {
    files: ["src/gas/server/**/*.ts"],
    languageOptions: {
      parser: tsParser as Linter.Parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin as Record<string, unknown>,
    },
    rules: sharedRules,
  },
  {
    files: ["src/gas/server/Code.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // --- GAS dialogs + shared (browser + google.script) ---
  {
    files: ["src/gas/dialogs/**/*.ts", "src/gas/shared/**/*.ts"],
    languageOptions: {
      parser: tsParser as Linter.Parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        document: "readonly",
        window: "readonly",
        console: "readonly",
        google: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLCanvasElement: "readonly",
        MouseEvent: "readonly",
        Event: "readonly",
        Image: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        MutationObserver: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        alert: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin as Record<string, unknown>,
    },
    rules: sharedRules,
  },

  // --- Build scripts (Node.js) ---
  {
    files: ["scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser as Linter.Parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin as Record<string, unknown>,
    },
    rules: sharedRules,
  },
];

export default config;
