"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string };

const CHIPS = ["Load-shedding mein kya chalega?", "Battery lagwani chahiye?", "Net billing kya hai?", "What should I ask my installer?"];

// Minimal typing for the browser Web Speech API
type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void; stop: () => void };

export default function Assistant() {
  const { lang, t } = useLang();
  const path = usePathname();
  const reportId = path?.startsWith("/report/") ? path.split("/")[2] : undefined;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [attach, setAttach] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const recRef = useRef<SR | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener("roshni:open-assistant", open);
    return () => window.removeEventListener("roshni:open-assistant", open);
  }, []);

  async function send(text: string) {
    if ((!text.trim() && !attach) || busy) return;
    if (attach && !consent) { alert("Please tick the box to agree to AI processing of the attachment."); return; }
    const content = attach ? `📎 ${attach.name}${text.trim() ? " — " + text : ""}` : text;
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next); setInput(""); setBusy(true);
    const file = attach; setAttach(null);
    try {
      let r: { reply: string };
      if (file) {
        const fd = new FormData();
        fd.append("messages", JSON.stringify(next));
        if (reportId) fd.append("report_id", reportId);
        fd.append("files", file);
        fd.append("consent", "true");
        r = await api.upload<{ reply: string }>("/chat/upload", fd);
      } else {
        r = await api.post<{ reply: string }>("/chat", { messages: next, report_id: reportId });
      }
      setMsgs([...next, { role: "assistant", content: r.reply }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `Sorry, something went wrong: ${(e as Error).message}` }]);
    } finally { setBusy(false); }
  }

  function toggleMic() {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) { alert("Voice input is not supported in this browser. Try Chrome."); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new Ctor();
    rec.lang = lang === "ur" ? "ur-PK" : "en-PK";
    rec.interimResults = false;
    rec.onresult = (e) => setInput((p) => (p ? p + " " : "") + e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  }

  function speak(text: string) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[؀-ۿ]/.test(text) ? "ur-PK" : "en-US";
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  return (
    <div className="no-print">
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-4 end-4 z-40 rounded-full bg-sun text-[#2a1d00] font-semibold px-5 py-3 shadow-lg">
          💬 {t("askMadadgar")}
        </button>
      )}
      {open && (
        <div className="fixed z-50 bottom-0 end-0 sm:bottom-4 sm:end-4 w-full sm:w-[380px] h-[75vh] sm:h-[560px] bg-surface border border-line sm:rounded-2xl shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div>
              <div className="font-semibold">Roshni Madadgar</div>
              <div className="text-xs text-muted">{reportId ? "Knows your report" : "English · اردو · Roman Urdu"}</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-xl px-2">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {msgs.length === 0 && (
              <div className="text-muted">
                <p className="mb-2">Ask anything about solar, your bill or your report. Type or speak in Urdu, Roman Urdu or English.</p>
                <div className="flex flex-wrap gap-2">
                  {CHIPS.map((c) => (
                    <button key={c} onClick={() => send(c)} className="px-3 py-1 rounded-full border border-line hover:bg-bg text-ink">{c}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div dir="auto" className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${m.role === "user" ? "bg-sun/20" : "bg-bg"} ${/[؀-ۿ]/.test(m.content) ? "urdu" : ""}`}>
                  {m.content}
                  {m.role === "assistant" && (
                    <button onClick={() => speak(m.content)} className="block mt-1 text-xs text-muted hover:text-ink" aria-label="Read aloud">🔊 Listen</button>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="text-muted">…</div>}
            <div ref={endRef} />
          </div>
          {attach && (
            <div className="px-3 pt-2 text-xs space-y-1 border-t border-line">
              <div className="flex items-center justify-between"><span className="truncate">📎 {attach.name}</span><button onClick={() => setAttach(null)} className="text-bad">✕</button></div>
              <label className="!text-ink !text-xs flex items-start gap-2"><input type="checkbox" className="w-3.5 h-3.5 mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I agree this file is sent to Google Gemini to read it.</label>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="p-3 border-t border-line flex gap-2">
            <label className="rounded-xl px-3 border border-line cursor-pointer flex items-center !mb-0 !text-base" aria-label="Attach a photo or PDF">📎
              <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => { setAttach(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <button type="button" onClick={toggleMic} aria-label="Voice input"
              className={`rounded-xl px-3 border border-line ${listening ? "bg-bad/20" : ""}`}>{listening ? "■" : "🎤"}</button>
            <input dir="auto" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Yeh kWp kya hota hai?" />
            <button type="submit" disabled={busy} className="rounded-xl px-4 bg-sun text-[#2a1d00] font-semibold">→</button>
          </form>
        </div>
      )}
    </div>
  );
}
