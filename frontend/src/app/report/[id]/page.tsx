import { Suspense } from "react";
import ReportView from "./ReportView";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading report…</p>}>
      <ReportView />
    </Suspense>
  );
}
