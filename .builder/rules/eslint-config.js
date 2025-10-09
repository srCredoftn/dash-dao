// .builder/rules/eslint-config.js
// Configuration ESLint pour respecter les règles Builder.io

export default {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
    project: ["./tsconfig.json"],
    tsconfigRootDir: ".",
  },
  plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y"],
  rules: {
    // Règles générales de qualité
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-debugger": "error",
    "no-alert": "warn",
    "no-var": "error",
    "prefer-const": "error",
    "no-unused-vars": "off", // Géré par TypeScript
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

    // ESM obligatoire
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.name='require']",
        message: "Use ES6 imports instead of require()",
      },
    ],

    // Nommage
    camelcase: ["error", { properties: "never" }],
    "@typescript-eslint/naming-convention": [
      "error",
      {
        selector: "variableLike",
        format: ["camelCase", "PascalCase", "UPPER_CASE"],
      },
      {
        selector: "typeLike",
        format: ["PascalCase"],
      },
      {
        selector: "property",
        format: ["camelCase", "snake_case", "PascalCase"],
      },
    ],

    // TypeScript strict
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",

    // React
    "react/react-in-jsx-scope": "off", // React 17+
    "react/prop-types": "off", // TypeScript handles this
    "react/jsx-uses-react": "off",
    "react/jsx-uses-vars": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // Accessibilité
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/anchor-is-valid": "error",

    // Import/Export
    "import/no-default-export": "off",
    "import/prefer-default-export": "off",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  ignorePatterns: [
    "dist/",
    "build/",
    "node_modules/",
    "*.config.js",
    "*.config.ts",
  ],
};
