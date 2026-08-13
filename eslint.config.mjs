import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Feature folders under features/. Each one owns its internals; the rules below
// stop other features from reaching past a feature's entry files into them.
const FEATURES = ["auth", "chat", "database", "models", "security"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Obsidian plugin bundles — not our source.
    "docs/.obsidian/**",
    // Prisma's generated client — rebuilt by `prisma generate`, never edited.
    "prisma/generated/**",
    // Vendored agent skills — committed, but hashed in skills-lock.json.
    ".claude/skills/**",
    ".agents/skills/**",
  ]),

  // The project's own rules. Each one maps to a line in CLAUDE.md — if a rule
  // here has no rule there, it does not belong here.
  {
    name: "llm-arena/standards",
    rules: {
      // "Strict TypeScript, no `any`." next's recommended set has this as a
      // warning, which means it gets ignored. It is an error here.
      "@typescript-eslint/no-explicit-any": "error",

      // Type-only imports are erased at build time. Marking them keeps runtime
      // imports honest — it is visible which imports actually pull in code.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],

      // An unused variable is either a leftover or a bug. `_`-prefixed names
      // are the deliberate opt-out, for signatures whose shape is fixed.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // "Immutable data, `const` and `readonly`." Reassigning a parameter
      // mutates the caller's mental model of what it passed in.
      "no-param-reassign": ["error", { props: true }],
      "prefer-const": "error",
      "no-var": "error",

      // A stream or a database call that is never awaited fails silently and
      // finishes after the response has already been sent. This is the single
      // most likely real bug in an app built out of parallel model calls.
      "no-void": ["error", { allowAsStatement: true }],
      "require-atomic-updates": "error",

      // "Side effects pushed to the edges" — a mutating array method used where
      // a pure one exists is the common way that leaks back in.
      "no-restricted-properties": [
        "error",
        {
          object: "console",
          property: "log",
          message:
            "Server logs should carry the real error and stay off the client. Use console.error or console.warn so the intent is explicit.",
        },
      ],

      // Folder-by-feature only holds if features import each other through
      // their own files rather than reaching into each other's internals.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../features/*/*", "../../../features/*/*"],
              message:
                "Import a feature through '@/features/<name>/...' rather than climbing out of your own folder.",
            },
            {
              group: ["@/prisma/generated/*"],
              message:
                "Import the Prisma client from '@/features/database/prisma' — it is the only place a client is constructed.",
            },
          ],
        },
      ],
    },
  },

  // Config files at the repo root run in Node, outside the app, and legitimately
  // read process.env directly and log at startup.
  {
    name: "llm-arena/config-files",
    files: ["*.mjs", "*.ts", "*.config.ts", "instrumentation.ts", "env.ts"],
    ignores: ["app/**", "features/**"],
    rules: {
      "no-restricted-properties": "off",
    },
  },

  // A feature may not import another feature's internals. features/chat can use
  // features/models' exports; it cannot reach into a file that feature never
  // meant to hand out. Expressed per-feature so the message names the offender.
  ...FEATURES.map((feature) => ({
    name: `llm-arena/feature-boundary/${feature}`,
    files: [`features/${feature}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: FEATURES.filter((other) => other !== feature).map(
                (other) => `@/features/${other}/**/*/**`,
              ),
              message:
                "Reach another feature through its top-level files only, not into its subfolders.",
            },
          ],
        },
      ],
    },
  })),
]);

export default eslintConfig;
