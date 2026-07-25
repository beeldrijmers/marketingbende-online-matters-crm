# Suggested commands

Setup/run:
- make install
- make start (local Supabase + Vite)
- make stop
- make start-demo (FakeRest)
- npm run dev:remote (Vite against remote environment)
- npm run preview
- npm run storybook

Quality/completion:
- make test or npm run test:unit:app
- npm run test:unit:functions
- make typecheck or npm run typecheck
- make lint or npm run lint
- npm run prettier
- make build or npm run build
- npx -y react-doctor@latest . --verbose --diff after React changes
- npx playwright test for end-to-end coverage

Database/registry:
- npx supabase db diff --local -f <name>
- npx supabase migration up --local
- npx supabase db push (remote mutation; only when explicitly in scope)
- npx supabase db reset --local (destructive; avoid unless clearly authorized)
- make registry-gen
- make registry-build

Darwin utilities: git status/log/diff/worktree; ls; cd; rg and rg --files (preferred over grep/find); sed; open when appropriate.