import themeCss from "./theme.css?raw";

/**
 * The palette has to keep passing WCAG AA in both modes.
 *
 * Colours are authored in oklch (and mixed with color-mix), which is perceptual
 * rather than photometric: a value that looks fine can still fail contrast. This
 * converts the tokens the same way a browser does and fails the build when a
 * pair drops below its threshold.
 */
const blockOf = (selector: string) => {
  const start = themeCss.indexOf(`${selector} {`);
  const end = themeCss.indexOf("\n}", start);
  return themeCss.slice(start, end);
};

const parseVars = (block: string) => {
  const vars: Record<string, string> = {};
  for (const match of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    vars[match[1]] = match[2].trim().replace(/\s+/g, " ");
  }
  return vars;
};

const OKLCH = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\)$/;

const oklchToOklab = (l: number, c: number, hDeg: number) => {
  const h = (hDeg * Math.PI) / 180;
  return [l, c * Math.cos(h), c * Math.sin(h)] as const;
};

const oklabToLinearRgb = ([L, a, b]: readonly [number, number, number]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ] as const;
};

const toOklab = (
  value: string,
  vars: Record<string, string>,
  depth = 0,
): readonly [number, number, number] => {
  if (depth > 6) throw new Error(`token loop at ${value}`);
  const variable = value.match(/^var\((--[\w-]+)\)$/);
  if (variable) return toOklab(vars[variable[1]], vars, depth + 1);
  const mix = value.match(/^color-mix\(in oklab,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/);
  if (mix) {
    const share = Number(mix[2]) / 100;
    const first = toOklab(mix[1], vars, depth + 1);
    const second = toOklab(mix[3], vars, depth + 1);
    return [
      first[0] * share + second[0] * (1 - share),
      first[1] * share + second[1] * (1 - share),
      first[2] * share + second[2] * (1 - share),
    ] as const;
  }
  const oklch = value.match(OKLCH);
  if (!oklch) throw new Error(`unsupported colour: ${value}`);
  return oklchToOklab(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
};

const luminance = (value: string, vars: Record<string, string>) => {
  const [r, g, b] = oklabToLinearRgb(toOklab(value, vars));
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
};

const contrast = (fg: string, bg: string, vars: Record<string, string>) => {
  const first = luminance(vars[fg], vars);
  const second = luminance(vars[bg], vars);
  const [hi, lo] = first > second ? [first, second] : [second, first];
  return (hi + 0.05) / (lo + 0.05);
};

const light = parseVars(blockOf(":root"));
const dark = { ...light, ...parseVars(blockOf(".dark")) };

// 4.5 for anything that renders as text, 3 for icons and other UI shapes.
const TEXT_PAIRS: [string, string][] = [
  ["--ink", "--canvas"],
  ["--ink-2", "--canvas"],
  ["--ink-3", "--canvas"],
  ["--ink", "--raised"],
  ["--ink-2", "--raised"],
  ["--ink-3", "--raised"],
  ["--ink-3", "--sunken"],
  ["--accent-ink", "--accent-base"],
  ["--late", "--late-tint"],
  ["--wait", "--wait-tint"],
  ["--live", "--live-tint"],
  ["--info", "--info-tint"],
  ["--late", "--raised"],
  ["--wait", "--raised"],
  ["--live", "--raised"],
  ["--info", "--raised"],
  ["--party-mb", "--sunken"],
  ["--party-om", "--sunken"],
  ["--party-gma", "--sunken"],
];

const UI_PAIRS: [string, string][] = [
  ["--accent-base", "--canvas"],
  ["--focus", "--canvas"],
];

describe("theme contrast", () => {
  for (const [mode, vars] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    describe(mode, () => {
      it.each(TEXT_PAIRS)("%s on %s passes AA for text", (fg, bg) => {
        expect(contrast(fg, bg, vars)).toBeGreaterThanOrEqual(4.5);
      });

      it.each(UI_PAIRS)("%s on %s passes AA for UI shapes", (fg, bg) => {
        expect(contrast(fg, bg, vars)).toBeGreaterThanOrEqual(3);
      });
    });
  }
});
