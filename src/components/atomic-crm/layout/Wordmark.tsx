import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";

/**
 * The Kompas lockup: the mark carries the colour, the word stays ink.
 *
 * The wordmark used to be gradient-filled text, which fought the mark right
 * next to it and read as decoration. One coloured element per lockup is enough.
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
  const hasCrmSuffix = / CRM$/i.test(title.trim());
  const mainText = hasCrmSuffix
    ? title.trim().replace(/ CRM$/i, "")
    : title.trim();

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
        <span className="sr-only">{title}</span>
      ) : (
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          {/* Set in caps: six short letters read as a mark this way, and the
              wide tracking keeps them from clotting into one shape. */}
          <span
            className={cn(
              "font-semibold uppercase leading-none tracking-[0.16em]",
              size === "lg" ? "text-lead" : "text-[0.875rem]",
              tone === "invert" ? "text-white" : "text-ink",
            )}
          >
            {mainText}
          </span>
          {hasCrmSuffix ? (
            <span
              className={cn(
                "text-eyebrow leading-none",
                tone === "invert" ? "text-white/65" : "text-ink-3",
              )}
            >
              CRM
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
};
