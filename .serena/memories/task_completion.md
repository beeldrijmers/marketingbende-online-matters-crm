# Task completion checklist

1. Preserve unrelated dirty-worktree changes and inspect git diff/status.
2. Add or update focused unit/integration tests for changed behavior.
3. Run relevant Vitest projects, TypeScript typecheck, ESLint and Prettier checks.
4. Run a production build when frontend/build behavior changed.
5. After React changes run react-doctor with --verbose --diff and ensure score does not regress.
6. Run relevant Playwright flows for user-facing behavior when practical.
7. Regenerate registry.json when registered components changed; pre-commit does this automatically, but registry output may already be dirty user work.
8. For DB changes update declarative supabase/schemas first, generate/apply migrations locally, and avoid remote push without explicit scope.
9. Summarize implemented outcomes, verification, remaining risks and exact files changed; do not commit or push unless asked.