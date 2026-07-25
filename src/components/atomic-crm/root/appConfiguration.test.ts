import { dealStages } from "./appConfiguration";

/**
 * The seeded `public.configuration` row wins over the code defaults at login
 * (useConfigurationLoader), so a label change that only lands in
 * appConfiguration.ts silently reverts in production. This test fails if the
 * two ever drift apart again.
 */
const migrations = import.meta.glob("../../../../supabase/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const latestDealStagesMigration = () => {
  const entries = Object.entries(migrations)
    .filter(([, sql]) => sql.includes("'{dealStages}'"))
    .sort(([left], [right]) => left.localeCompare(right));
  return entries.at(-1);
};

const parseStages = (sql: string) => {
  const match = sql.match(/\$json\$(\[[\s\S]*?\])\$json\$/);
  if (!match) throw new Error("No $json$ array found in the migration");
  return JSON.parse(match[1]) as { value: string; label: string }[];
};

describe("appConfiguration", () => {
  it("ships the same deal stages as the latest migration seeds", () => {
    const latest = latestDealStagesMigration();
    expect(latest, "expected a migration that seeds dealStages").toBeDefined();
    const [, sql] = latest!;

    // The migration seeds what users read; the short labels are presentation
    // only and stay in code.
    expect(parseStages(sql)).toEqual(
      dealStages.map(({ label, value }) => ({ label, value })),
    );
  });

  it("keeps stage labels free of Trello list numbers", () => {
    for (const stage of dealStages) {
      expect(stage.label).not.toMatch(/^\d/);
    }
  });
});
