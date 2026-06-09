import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X, Loader2 } from "lucide-react";

const STARTERS_EN = [
  "Why not connect every household directly?",
  "What happens if population grows faster than 2%/year?",
  "How does gravity pressure work for this village?",
];
const STARTERS_FR = [
  "Pourquoi ne pas connecter chaque ménage directement ?",
  "Que se passe-t-il si la population croît plus vite que 2 %/an ?",
  "Comment fonctionne la pression gravitaire pour ce village ?",
];

export function AdvisorPanel({ open, onClose, lang }: { open: boolean; onClose: () => void; lang: "en" | "fr" }) {
  const transport = useRef(new DefaultChatTransport({ api: "/api/advisor" })).current;
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const isLoading = status === "submitted" || status === "streaming";
  const starters = lang === "fr" ? STARTERS_FR : STARTERS_EN;

  const send = (text: string) => {
    const t = text.trim();
    if (!t || isLoading) return;
    sendMessage({ text: t });
    setInput("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">{lang === "fr" ? "Conseiller IA" : "AI Advisor"}</div>
            <div className="text-[10px] text-muted-foreground">{lang === "fr" ? "Expert · infrastructure eau Guinée" : "Expert · rural Guinea water infrastructure"}</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" /> {lang === "fr" ? "Posez une question" : "Ask anything"}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {lang === "fr"
                  ? "Demandez des arbitrages d'investissement, des compromis techniques, ou des scénarios de risque."
                  : "Ask about investment tradeoffs, technical choices, or risk scenarios."}
              </p>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{lang === "fr" ? "Pour commencer" : "Try a starter"}</div>
            <div className="flex flex-col gap-1.5">
              {starters.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-md border bg-card px-3 py-2 text-left text-xs hover:border-primary/40 hover:bg-primary/5">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${isUser ? "bg-primary text-primary-foreground" : "bg-muted/60"}`}>
                {text || (isLoading ? "…" : "")}
              </div>
            </div>
          );
        })}
        {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin" /> {lang === "fr" ? "Réflexion…" : "Thinking…"}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t bg-card p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={lang === "fr" ? "Posez une question…" : "Ask a question…"}
            rows={2}
            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
