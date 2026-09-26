module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  settings: {
    "import/resolver": {
      typescript: {},
    },
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.eslint.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import", "react-hooks"],
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "import/no-duplicates": "error",
  },
  overrides: [
    {
      files: ["*.js"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
      },
    },
  ],
};
