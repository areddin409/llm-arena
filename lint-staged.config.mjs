/**
 * What the pre-commit hook actually runs, against staged files only.
 *
 * ESLint runs before Prettier so that an autofix (an added type-only import,
 * say) still gets formatted afterwards. `--no-warn-ignored` keeps a staged file
 * that ESLint ignores from failing the whole commit.
 */
const config = {
  "*.{ts,tsx,mts,mjs}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
  ],
  "*.{json,md,css,yaml,yml}": ["prettier --write --ignore-unknown"],
};

export default config;
