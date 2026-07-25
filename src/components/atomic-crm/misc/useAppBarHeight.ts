import { useIsMobile } from "@/hooks/use-mobile";

// Mirrors --app-bar-h / the desktop page header, for the few places that need
// the value in JavaScript (empty-state centring).
const DESKTOP_APP_BAR_HEIGHT = 48;
const MOBILE_APP_BAR_HEIGHT = 56;

export default function useAppBarHeight(): number {
  const isMobile = useIsMobile();
  return isMobile ? MOBILE_APP_BAR_HEIGHT : DESKTOP_APP_BAR_HEIGHT;
}
