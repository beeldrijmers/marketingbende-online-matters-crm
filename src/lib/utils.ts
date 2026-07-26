import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The theme's own type scale, taught to tailwind-merge.
 *
 * Without this, `cn("text-meta", "text-ink-3")` returned only `text-ink-3`:
 * tailwind-merge knows `text-sm` and `text-base` as font sizes and files
 * anything else under `text-*` as a COLOUR, so a custom size and a colour were
 * treated as the same property and the size lost. Silent, and invisible in the
 * source, because the class is right there in the code.
 *
 * Keep in step with the --text-* tokens in styles/theme.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "eyebrow",
            "meta",
            "body",
            "lead",
            "section",
            "figure",
            "title",
            "display",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
