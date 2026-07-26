import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";

/**
 * The Kompas lockup: the mark carries the colour, the word stays ink.
 *
 * The word is set in Archivo Black, the only place in the app that uses a
 * display face. A heavy, wide face wants the opposite of what the previous Geist
 * setting did: the tracking comes almost all the way in, because at 0.16em
 * letters this solid stop reading as one mark and fall apart into six shapes.
 *
 * `tone="invert"` is for the login panel, which is dark in both themes and
 * would otherwise put dark ink on a dark gradient for light-mode visitors.
 */
export const Wordmark = ({
  compact = false,
  size = "sm",
  tone = "ink",
}: {
  compact?: boolean;
  size?: "sm" | "lg";
  tone?: "ink" | "invert";
}) => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const word = title.trim();

  return (
    <span
      className={cn("flex items-center", size === "lg" ? "gap-3" : "gap-2.5")}
    >
      <img
        className={cn(
          "shrink-0",
          size === "lg" ? "size-7" : "size-6",
          tone === "invert" ? "" : "[.light_&]:hidden",
        )}
        src={darkModeLogo}
        alt=""
        aria-hidden
      />
      {tone === "invert" ? null : (
        <img
          className={cn(
            "[.dark_&]:hidden shrink-0",
            size === "lg" ? "size-7" : "size-6",
          )}
          src={lightModeLogo}
          alt=""
          aria-hidden
        />
      )}
      {compact ? (
        <span className="sr-only">{word}</span>
      ) : (
        <span
          className={cn(
            "font-wordmark whitespace-nowrap uppercase leading-none tracking-[0.02em]",
            size === "lg" ? "text-lead" : "text-[0.875rem]",
            tone === "invert" ? "text-white" : "text-ink",
          )}
        >
          {word}
        </span>
      )}
    </span>
  );
};
