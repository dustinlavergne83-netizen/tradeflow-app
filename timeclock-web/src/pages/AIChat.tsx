import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Who's clocked in right now?",
  "How many hours did my team work this week?",
  "Who worked the most hours last week?",
  "Show me hours by job this week",
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your TradeFlow AI assistant 🤖\n\nAsk me anything about your team's hours, who's working, or job summaries. Try one of the suggestions below to get started!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Build context from recent shifts
      const { data: shifts } = await supabase
        .from("shifts")
        .select("user_id, clock_in, clock_out")
        .gte("clock_in", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("clock_in", { ascending: false })
        .limit(100);

      const userIds = [...new Set((shifts ?? []).map((s: any) => s.user_id).filter(Boolean))];
      const { data: empRows } = await supabase.from("employees")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);
      const empMap: Record<string, string> = {};
      for (const e of (empRows ?? [])) empMap[e.user_id] = `${e.first_name} ${e.last_name}`;

      const shiftSummary = (shifts ?? []).map((s: any) => {
        const hrs = s.clock_out
          ? ((new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3600000).toFixed(1)
          : "still clocked in";
        return `${empMap[s.user_id] ?? "Unknown"}: ${new Date(s.clock_in).toLocaleDateString()} ${hrs}h`;
      }).join("\n");

      const systemPrompt = `You are a helpful assistant for TradeFlow, a GPS time clock app for trade contractors.
You have access to recent shift data (last 7 days):

${shiftSummary}

Answer the user's question based on this data. Be concise and helpful. Format numbers clearly.`;

      const { data, error } = await supabase.functions.invoke("openai-chat", {
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            ...newMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
        },
      });

      if (error) throw error;

      const reply = data?.choices?.[0]?.message?.content ?? "Sorry, I couldn't get a response. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error("AI error: " + e.message);
      setMessages([...newMessages, {
        role: "assistant",
        content: "Sorry, I ran into an error. Please check that the AI function is deployed and try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-gray-900">🤖 AI Assistant</h1>
        <p className="text-gray-500 text-sm mt-0.5">Ask about your team's hours, jobs, and more</p>
      </div>

      {/* Chat window */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user"
                    ? "text-white font-medium"
                    : "bg-gray-100 text-gray-800"
                }`}
                style={msg.role === "user" ? { backgroundColor: "#0b3ea8" } : {}}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-500">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about your team…"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: "#0b3ea8" }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
