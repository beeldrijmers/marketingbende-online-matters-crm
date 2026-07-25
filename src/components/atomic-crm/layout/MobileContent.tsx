import { type ReactNode } from "react";

/**
 * The scrolling area between the fixed top bar and the bottom navigation.
 *
 * Both offsets come from tokens, so content can never end up underneath either
 * bar again (they used to be hardcoded at different values).
 */
export const MobileContent = ({ children }: { children: ReactNode }) => (
  <main
    className="min-h-screen w-full overflow-y-auto px-4"
    id="main-content"
    style={{
      paddingTop: "calc(var(--app-bar-h) + 0.75rem)",
      // Room for the bar, the floating button above it and the home indicator.
      paddingBottom: "calc(var(--bottom-nav-h) + var(--safe-b) + 5.5rem)",
    }}
  >
    {children}
  </main>
);
