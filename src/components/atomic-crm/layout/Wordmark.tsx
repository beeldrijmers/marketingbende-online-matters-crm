import { useConfigurationContext } from "../root/ConfigurationContext";

/**
 * The BANKAI lockup: the mark carries the colour, the word stays ink.
 *
 * The wordmark used to be gradient-filled text, which fought the mark right
 * next to it and read as decoration. One coloured element per lockup is enough.
 */
export const Wordmark = ({ compact = false }: { compact?: boolean }) => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const hasCrmSuffix = / CRM$/i.test(title.trim());
  const mainText = hasCrmSuffix
    ? title.trim().replace(/ CRM$/i, "")
    : title.trim();

  return (
    <span className="flex items-center gap-2.5">
      <img
        className="[.light_&]:hidden size-6 shrink-0"
        src={darkModeLogo}
        alt=""
        aria-hidden
      />
      <img
        className="[.dark_&]:hidden size-6 shrink-0"
        src={lightModeLogo}
        alt=""
        aria-hidden
      />
      {compact ? (
        <span className="sr-only">{title}</span>
      ) : (
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[0.9375rem] font-bold leading-none tracking-[0.02em] text-ink">
            {mainText}
          </span>
          {hasCrmSuffix ? (
            <span className="text-eyebrow leading-none text-ink-3">CRM</span>
          ) : null}
        </span>
      )}
    </span>
  );
};
