import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────
const BLUE = "#0b3ea8";
const ORANGE = "#fc6b04";

// ── AIAssistant Component ─────────────────────────────────────────────────────
// Renders as a big button on the Home page that opens a chat modal
export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 Hey Dustin! I'm your DML AI assistant.\n\nI can help you:\n• 🎤 Dictate material lists\n• 📅 Set reminders\n• ✨ Generate proposals & invoices\n• 📊 Check project & invoice status\n\nClick the mic to talk or type below!",
      timestamp: new Date(),
    },
  ]);
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const durationTimerRef = useRef(null);
  const recordingDurationRef = useRef(0); // ref so onstop closure always has latest value

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []);

  // ── Voice Recording (Web MediaRecorder API) ───────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        // Use ref (not state) — state would be stale inside this closure
        if (recordingDurationRef.current < 1) {
          setIsLoading(false);
          return; // Too short
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const base64 = await blobToBase64(audioBlob);
        await sendToAI({ type: "voice", audioBase64: base64, audioFormat: "webm" });
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;

      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          const next = d + 1;
          recordingDurationRef.current = next; // keep ref in sync
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error("Mic error:", err);
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  }, []); // no deps needed — all state accessed via refs

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      setIsRecording(false);
      setIsLoading(true);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  // ── Convert Blob to base64 ────────────────────────────────────────────────
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // ── Send Text Message ─────────────────────────────────────────────────────
  const sendTextMessage = useCallback(async () => {
    const text = textInput.trim();
    if (!text || isLoading) return;
    setTextInput("");
    await sendToAI({ type: "text", message: text });
  }, [textInput, isLoading]);

  // ── Core: Send to AI Edge Function ────────────────────────────────────────
  const sendToAI = useCallback(
    async (input) => {
      const userMsg = {
        id: Date.now().toString(),
        role: "user",
        content:
          input.type === "voice" ? "🎤 Processing voice..." : input.message || "",
        isVoice: input.type === "voice",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const history = messages
          .filter((m) => m.id !== "welcome")
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }));

        const { data, error } = await supabase.functions.invoke("ai-assistant", {
          body: { ...input, conversationHistory: history },
        });

        if (error) throw error;

        // Update user message with voice transcript
        if (input.type === "voice" && data.transcript) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMsg.id ? { ...m, content: data.transcript } : m
            )
          );
        }

        const aiMsg = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
          action: data.action,
          actionData: data.actionData,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        console.error("AI error:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              "⚠️ Something went wrong. Please try again.\n\nError: " +
              (err.message || "Unknown"),
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  // ── Copy to clipboard helper ──────────────────────────────────────────────
  const copyToClipboard = async (text, label = "Copied!") => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`✅ ${label}`);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      alert(`✅ ${label}`);
    }
  };

  // ── Render individual message ─────────────────────────────────────────────
  const renderMessage = (msg) => {
    const isUser = msg.role === "user";

    return (
      <div
        key={msg.id}
        style={{
          display: "flex",
          justifyContent: isUser ? "flex-end" : "flex-start",
          marginBottom: 12,
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        {!isUser && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: BLUE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            🤖
          </div>
        )}

        <div
          style={{
            maxWidth: "78%",
            backgroundColor: isUser ? BLUE : "#fff",
            color: isUser ? "#fff" : "#111827",
            borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            padding: "10px 14px",
            boxShadow: isUser ? "none" : "0 1px 4px rgba(0,0,0,0.08)",
            fontSize: 14,
            lineHeight: "1.6",
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.content}

          {/* Action Buttons */}
          {msg.action === "add_materials" && msg.actionData?.materials && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() =>
                  copyToClipboard(
                    msg.actionData.materials
                      .map((m) => `${m.qty} ${m.unit} - ${m.item}`)
                      .join("\n"),
                    "Material list copied!"
                  )
                }
                style={actionBtnStyle}
              >
                📋 Copy Material List
              </button>
            </div>
          )}

          {(msg.action === "generate_proposal" ||
            msg.action === "generate_invoice_description") &&
            msg.actionData?.text && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() =>
                    copyToClipboard(
                      msg.actionData.text,
                      "Text copied! Paste it into your estimate or proposal."
                    )
                  }
                  style={actionBtnStyle}
                >
                  📋 Copy Text
                </button>
                <div
                  style={{
                    marginTop: 8,
                    padding: "10px 12px",
                    backgroundColor: "#f3f4f6",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#374151",
                    fontStyle: "italic",
                    lineHeight: "1.5",
                    whiteSpace: "pre-wrap",
                    width: "100%",
                  }}
                >
                  {msg.actionData.text}
                </div>
              </div>
            )}

          {msg.action === "set_reminder" && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#fef3c7",
                padding: "6px 10px",
                borderRadius: 8,
              }}
            >
              <span>🔔</span>
              <span style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                Reminder saved — dashboard will show it
              </span>
            </div>
          )}

          <div
            style={{
              fontSize: 10,
              color: isUser ? "rgba(255,255,255,0.6)" : "#9ca3af",
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {msg.timestamp.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Main Button (collapsed state) ─────────────────────────────────────────
  const AIButton = () => (
    <div
      style={{
        background: `linear-gradient(135deg, ${BLUE} 0%, #1a56d6 100%)`,
        borderRadius: 16,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(11,62,168,0.3)",
        transition: "transform 0.2s, box-shadow 0.2s",
        marginBottom: 24,
        userSelect: "none",
      }}
      onClick={() => setIsOpen(true)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(11,62,168,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(11,62,168,0.3)";
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          backgroundColor: "rgba(255,255,255,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          flexShrink: 0,
        }}
      >
        🤖
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, marginBottom: 4 }}>
          Ask AI Assistant
        </div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>
          Reminders • Material lists • Proposals • Invoices
        </div>
      </div>
      <div
        style={{
          backgroundColor: ORANGE,
          color: "#fff",
          borderRadius: 20,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 700,
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        🎤 Talk
      </div>
    </div>
  );

  // ── Chat Modal ────────────────────────────────────────────────────────────
  const ChatModal = () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        padding: 20,
        pointerEvents: "none",
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          pointerEvents: "all",
          backdropFilter: "blur(2px)",
        }}
        onClick={() => setIsOpen(false)}
      />

      {/* Chat Window */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 480,
          height: "80vh",
          maxHeight: 680,
          backgroundColor: "#f3f4f6",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          pointerEvents: "all",
          animation: "slideUp 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: BLUE,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
              🤖 DML AI Assistant
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
              Voice & text • GPT-4o powered
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() =>
                setMessages([
                  {
                    id: "welcome",
                    role: "assistant",
                    content: "Chat cleared. How can I help you?",
                    timestamp: new Date(),
                  },
                ])
              }
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              🗑️ Clear
            </button>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 14,
          }}
        >
          {messages.map(renderMessage)}

          {isLoading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: BLUE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                🤖
              </div>
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "18px 18px 18px 4px",
                  padding: "12px 16px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={loadingDotStyle(0)} />
                <div style={loadingDotStyle(0.2)} />
                <div style={loadingDotStyle(0.4)} />
                <span style={{ fontSize: 13, color: "#6b7280", marginLeft: 4 }}>
                  Thinking...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div
            style={{
              backgroundColor: "#fee2e2",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                animation: "pulse 1s infinite",
              }}
            />
            <span style={{ fontSize: 13, color: "#991b1b", fontWeight: 600 }}>
              🎙️ Recording... {recordingDuration}s — Release mic to send
            </span>
          </div>
        )}

        {/* Input Area */}
        <div
          style={{
            backgroundColor: "#fff",
            borderTop: "1px solid #e5e7eb",
            padding: "10px 12px",
          }}
        >
          {/* Text input row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-end" }}>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendTextMessage();
                }
              }}
              placeholder="Type a message... (Enter to send)"
              disabled={isLoading || isRecording}
              rows={1}
              style={{
                flex: 1,
                border: "1.5px solid #d1d5db",
                borderRadius: 20,
                padding: "10px 16px",
                fontSize: 14,
                outline: "none",
                resize: "none",
                maxHeight: 80,
                fontFamily: "inherit",
                backgroundColor: "#f9fafb",
                color: "#111827",
              }}
            />
            <button
              onClick={sendTextMessage}
              disabled={!textInput.trim() || isLoading}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: textInput.trim() && !isLoading ? BLUE : "#d1d5db",
                border: "none",
                color: "#fff",
                cursor: textInput.trim() && !isLoading ? "pointer" : "default",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ➤
            </button>
          </div>

          {/* Mic button row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <span style={{ fontSize: 12, color: "#9ca3af" }}>Hold to talk</span>
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={isLoading}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: isRecording
                  ? "#ef4444"
                  : isLoading
                  ? "#d1d5db"
                  : BLUE,
                border: "none",
                color: "#fff",
                fontSize: 28,
                cursor: isLoading ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isRecording
                  ? "0 0 0 8px rgba(239,68,68,0.3)"
                  : "0 4px 16px rgba(11,62,168,0.35)",
                transition: "all 0.15s",
                transform: isRecording ? "scale(1.1)" : "scale(1)",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
            >
              {isRecording ? "🔴" : "🎤"}
            </button>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>or type above</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes blink {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      {/* Home page AI button */}
      <AIButton />

      {/* Full chat modal */}
      {isOpen && <ChatModal />}
    </>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const actionBtnStyle = {
  backgroundColor: ORANGE,
  border: "none",
  borderRadius: 20,
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

function loadingDotStyle(delay) {
  return {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#9ca3af",
    animation: `blink 1.2s ${delay}s ease-in-out infinite`,
  };
}
