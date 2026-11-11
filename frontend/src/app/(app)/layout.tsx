export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_85%_-10%,rgba(255,176,32,0.28),transparent_60%),radial-gradient(ellipse_at_0%_0%,rgba(47,107,255,0.08),transparent_55%)]" />
      <div className="relative w-full max-w-5xl mx-auto px-4 pt-28 pb-16 min-h-[70vh]">{children}</div>
    </div>
  );
}
