"use client";

import React, { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "model";
  text: string;
};

type Props = {
  context: {
    title: string;
    department: string;
    purpose: string;
  };
  onApply: (data: any) => void;
};

// ... existing SVG icons ...
const IconMagic = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 2 7 10-7 10"/><path d="m2 2 7 10-7 10"/><path d="M22 12h-8"/></svg>
);

// Inline SVG components
const IconSparkles = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="m5 3 1 1"/><path d="m19 3-1 1"/><path d="m5 19 1-1"/><path d="m19 19-1-1"/></svg>
);
const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
const IconSend = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
);
const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);
const IconLoader = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

export function SopAiAssistant({ context, onApply }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: "Hello! I'm your SOP Assistant. I can help you write a professional purpose, scope, or even the whole document. Try saying 'Create a full SOP for...' followed by your raw notes!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function extractJSON(text: string) {
    const match = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (!match) return null;
    try {
      const data = JSON.parse(match[1]);
      if (data?.type === "sop_autofill") return data.data;
    } catch (e) {}
    return null;
  }

  function cleanText(text: string) {
    return text.replace(/```json\s*(\{[\s\S]*?\})\s*```/g, "").trim();
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  async function handleSend(msg: string) {
    if (!msg.trim() || loading) return;

    const userMsg: Message = { role: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/sop-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context,
          history: messages.map((m) => ({
            role: m.role,
            parts: [{ text: m.text }],
          })),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success: boolean;
        data?: { text: string };
        error?: { message: string };
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to get AI response");
      }

      setMessages((prev) => [...prev, { role: "model", text: data.data?.text || "" }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "Something went wrong. Please check your API configuration or try again later." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "Suggest a Purpose statement",
    "List common Procedure steps",
    "What should be in the Scope?",
    "Suggest Safety requirements",
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          title="Ask SOP Assistant"
        >
          <IconSparkles />
        </button>
      ) : (
        <div className="flex h-[500px] w-80 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <IconSparkles />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">SOP Assistant</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Powered by Gemini AI</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 hover:bg-white/10 transition-colors">
              <IconX />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 p-4 scroll-smooth">
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all ${
                      m.role === "user" ? "bg-slate-900 text-white" : "bg-white text-slate-800"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{cleanText(m.text)}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.role === "model" && i > 0 && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(cleanText(m.text));
                          }}
                          className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <div className="h-3 w-3">
                            <IconCopy />
                          </div>
                          COPY
                        </button>
                      )}
                      {m.role === "model" && extractJSON(m.text) && (
                        <button
                          onClick={() => onApply(extractJSON(m.text))}
                          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 transition-all shadow-md group"
                        >
                          <div className="h-3 w-3 group-hover:animate-pulse">
                            <IconSparkles />
                          </div>
                          MAGIC FILL
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm animate-pulse">
                    <div className="h-4 w-4"><IconLoader /></div>
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 p-4 bg-white">
            {messages.length < 3 && !loading && (
              <div className="mb-4 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all border-dashed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
                placeholder="Ask me something..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition-all shadow-inner"
              />
              <button
                disabled={!input.trim() || loading}
                onClick={() => handleSend(input)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-30 shadow-lg"
              >
                <div className="h-5 w-5"><IconSend /></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
