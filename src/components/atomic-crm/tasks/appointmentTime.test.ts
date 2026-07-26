import { commands } from "vitest/browser";
import { describe, expect, it } from "vitest";

import { convertDateToString } from "@/components/admin/date-time-input";

/**
 * De heen- en terugweg van het tijdstip in de afspraakdialoog.
 *
 * Het veld is een `datetime-local`, dus zonder zone: het toont een wandklok. De
 * dialoog leest die string terug met `new Date(waarde)`, wat de browserzone
 * gebruikt. Formatteren moet dus ook lokaal. Stond hier `toISOString()`, dan
 * schoof elke bijwerking de afspraak met de zone-offset op, en in de zomer in
 * Amsterdam is dat twee uur.
 */
const leesTerugZoalsDeDialoog = (wandklok: string) =>
  new Date(wandklok).toISOString();

describe("tijdstip in de afspraakdialoog", () => {
  it("levert dezelfde instant op na formatteren en teruglezen", async () => {
    const instant = "2026-07-30T09:00:00.000Z";

    for (const zone of [
      "Europe/Amsterdam", // zomertijd, UTC+2
      "America/New_York", // negatieve offset
      "Asia/Tokyo",
      "UTC",
    ]) {
      await commands.setTimezone(zone);
      const wandklok = convertDateToString(new Date(instant));
      expect(leesTerugZoalsDeDialoog(wandklok)).toBe(instant);
    }
  });

  it("houdt ook in de winter dezelfde instant", async () => {
    // Amsterdam staat dan op UTC+1, dus een fout van een uur in plaats van twee.
    const instant = "2026-01-15T14:30:00.000Z";
    await commands.setTimezone("Europe/Amsterdam");
    expect(
      leesTerugZoalsDeDialoog(convertDateToString(new Date(instant))),
    ).toBe(instant);
  });

  it("toont de wandklok en niet UTC", async () => {
    await commands.setTimezone("Europe/Amsterdam");
    // 09:00 UTC is 11:00 in Amsterdam in juli. Precies deze regel ging fout.
    expect(convertDateToString(new Date("2026-07-30T09:00:00.000Z"))).toBe(
      "2026-07-30T11:00",
    );
    expect(
      new Date("2026-07-30T09:00:00.000Z").toISOString().slice(0, 16),
    ).toBe("2026-07-30T09:00");
  });
});
