export const normalizeHourlyRate = (
  value: unknown,
): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Het uurtarief moet nul of hoger zijn, of leeg blijven.");
  }

  return Math.round(value * 100) / 100;
};
