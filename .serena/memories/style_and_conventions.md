# Style and conventions

Use TypeScript/TSX ES modules and path aliases @/components, @/lib and @/hooks. React components and types use PascalCase; functions/hooks/variables use camelCase; hooks start with use. Prefer explicit types at integration/data boundaries and type-only imports where lint requests them. No unused variables except underscore-prefixed intentional values; console usage is limited to warn/error. Follow existing functional-component and composition patterns.

Prettier is authoritative. General formatting uses repository defaults; Markdown/MDX uses single quotes and 4-space tabs; src/components/ui/*.tsx follows shadcn formatting with no semicolons, double quotes, 2 spaces and ES5 trailing commas. Keep user-facing copy Dutch and reuse i18n keys. Preserve accessibility semantics and Radix/shadcn primitives.

Database schema changes start in supabase/schemas. Migrations are normally generated with Supabase diff and only manually adjusted when necessary. Do not delete sales users; disable accounts. Keep data-provider behavior compatible between Supabase and FakeRest where applicable.