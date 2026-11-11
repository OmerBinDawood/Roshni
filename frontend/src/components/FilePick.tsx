"use client";

export default function FilePick({ files, onChange, multiple = true, label }: {
  files: File[]; onChange: (f: File[]) => void; multiple?: boolean; label: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line p-5 text-center">
      <p className="font-medium">{label}</p>
      <p className="text-sm text-muted">JPG, PNG, HEIC or PDF · camera works on phones</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <label className="cursor-pointer !text-ink !text-base rounded-xl bg-sun/20 border border-sun/50 px-4 py-2">
          📷 Take photo
          <input className="hidden" type="file" accept="image/*" capture="environment"
            onChange={(e) => onChange(multiple ? [...files, ...Array.from(e.target.files ?? [])] : Array.from(e.target.files ?? []))} />
        </label>
        <label className="cursor-pointer !text-ink !text-base rounded-xl border border-line px-4 py-2">
          📁 Choose files
          <input className="hidden" type="file" multiple={multiple} accept="image/*,application/pdf"
            onChange={(e) => onChange(multiple ? [...files, ...Array.from(e.target.files ?? [])] : Array.from(e.target.files ?? []))} />
        </label>
      </div>
      {files.length > 0 && (
        <ul className="mt-3 text-sm space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex justify-center items-center gap-2">
              <span className="truncate max-w-[220px]">{f.name}</span>
              <button className="text-bad" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
