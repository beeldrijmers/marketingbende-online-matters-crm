# Marketingbende CRM

Purpose: internal CRM for Marketingbende x Online Matters, covering contacts, companies, deals/Kanban, tasks, notes, tags, sales users, inbound email capture and external integrations.

Stack: React 19 + TypeScript 5.8 + Vite 7; React Router 7; TanStack Query; React Hook Form; ra-core/react-admin headless; shadcn/Radix UI; Tailwind CSS 4; Supabase PostgreSQL/Auth/Storage/Edge Functions; Vitest, Storybook and Playwright.

Structure: main app code is in src/components/atomic-crm with feature folders; src/components/admin and src/components/ui are intentionally mutable dependencies; Supabase declarative schema in supabase/schemas is source of truth; migrations in supabase/migrations; edge functions in supabase/functions; e2e specs in e2e; domain configuration in src/components/atomic-crm/root/appConfiguration.ts and passed through src/App.tsx.

Patterns: Supabase views serve aggregate reads and FakeRest emulates them; auth users sync to sales via triggers; filters use ra-data-postgrest field@operator syntax; add DB fields in declarative schemas first and update views, FakeRest, imports/exports and merge logic where relevant.