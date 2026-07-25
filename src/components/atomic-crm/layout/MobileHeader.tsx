/** The phone's fixed top bar; its height is the shared --app-bar-h token. */
const MobileHeader = ({ children }: { children: React.ReactNode }) => (
  <header
    className="fixed inset-x-0 top-0 z-30 flex w-full items-center justify-between gap-2 border-b border-line-subtle bg-sidebar px-4"
    style={{ height: "var(--app-bar-h)" }}
  >
    {children}
  </header>
);

export default MobileHeader;
