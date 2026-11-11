"use client";
import { useRef, useState } from "react";

const OK = /^(image\/|application\/pdf)/;
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function FilePick({ files, onChange, multiple = true, label }: {
  files: File[]; onChange: (f: File[]) => void; multiple?: boolean; label: string;
}) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const add = (list: FileList | File[] | null) => {
    const incoming = Array.from(list ?? []).filter((f) => OK.test(f.type));
    if (incoming.length) onChange(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
  };
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`relative text-center p-6 sm:p-8 border-2 border-dashed transition-all duration-200 ${drag ? "border-ink bg-sun/25 scale-[1.01]" : "border-ink/30 bg-white hover:border-ink hover:bg-sun/10"}`}>
        <div className={`mx-auto w-14 h-14 grid place-items-center border-[1.5px] border-ink bg-sun text-2xl transition-transform ${drag ? "-translate-y-2 rotate-6" : ""}`} aria-hidden>⬆</div>
        <p className="mt-3 font-display font-extrabold text-lg">{label}</p>
        <p className="text-sm text-muted">Drag a file here, or choose one. JPG, PNG, HEIC or PDF · camera works on phones</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <label className="blk blk-primary !text-[0.7rem] relative overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--sun-deep)] !mb-0 !text-ink">
            <span className="!py-2.5 !px-4">📷 Take photo</span>
            <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="blk blk-ghost !text-[0.7rem] relative overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--sun-deep)] !mb-0 !text-ink">
            <span className="!py-2.5 !px-4">📁 Choose files</span>
            <input ref={input} className="sr-only" type="file" multiple={multiple} accept="image/*,application/pdf" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      {files.length > 0 && (
        <ul className="mt-3 grid sm:grid-cols-2 gap-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 border-[1.5px] border-ink bg-white px-3 py-2 text-sm animate-[pop_0.3s_ease_both]">
              <span className="w-8 h-8 shrink-0 grid place-items-center bg-sun/40 border border-ink text-xs font-mono font-bold">{f.type === "application/pdf" ? "PDF" : "IMG"}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{f.name}</span><span className="block text-xs text-muted">{size(f.size)}</span></span>
              <button type="button" className="text-bad font-bold px-2 py-1 hover:bg-bad/10" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
