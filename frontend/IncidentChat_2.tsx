/**
 * Incident detail panel "Ask a question" chat.
 *
 * Usage (from IncidentDetailPanel, inside the scrollable body, replacing the
 * old Close Notes / Details grid):
 *
 *   const [chatOpen, setChatOpen] = useState(false); // owned by IncidentDashboard, see below
 *
 *   <IncidentChatSection
 *     apiBaseUrl={apiBaseUrl}
 *     incidentNumber={incidentNumber}
 *     open={chatOpen}
 *     onOpenChange={setChatOpen}
 *   />
 *
 * `open`/`onOpenChange` are lifted all the way up to IncidentDashboard (not
 * owned locally) because opening the chat also auto-widens the split-pane
 * divider — see the IncidentDashboard.tsx diff for how that's wired.
 *
 * BACKEND: askIncidentQuestion() below POSTs to
 *   POST /api/incidents/{incident_number}/chat   body: { question: string }
 *   -> { answer: string }
 * That route doesn't exist yet (blocked on the Tachyon LLM connection) — the
 * component is fully wired and will just show a "couldn't get an answer"
 * error until the backend route is built. Nothing here needs to change once
 * it is; the request/response contract is what the backend needs to match.
 */

import { useEffect, useRef, useState } from "react";

// Small color subset matching the dashboard's Institutional Heritage theme,
// duplicated here (not imported) so this file drops in standalone — same
// approach as TeamsShare.tsx.
const c = {
  primary: "#af0017",
  onPrimary: "#ffffff",
  secondary: "#7a5900",
  tertiaryContainer: "#ebe2ce",
  surface: "#fcf9f8",
  surfaceContainerLow: "#f6f3f2",
  outlineVariant: "#e6bdb9",
  onSurface: "#1b1c1c",
  onSurfaceVariant: "#5c3f3d",
  errorText: "#93000a",
};
const fontBody = '"Work Sans", "Segoe UI", Arial, sans-serif';

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const STARTER_QUESTIONS = ["What caused this?", "Business impact?", "Who owns this?"];

function IconChat({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconSend({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
    </svg>
  );
}

function IconChevronLeft({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconSparkleSmall({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c.6 3.8 1.9 6.1 4 8.2 2.1 2 4.4 3.2 8 3.8-3.8.6-6.1 1.9-8.2 4-2 2.1-3.2 4.4-3.8 8-.6-3.8-1.9-6.1-4-8.2-2.1-2-4.4-3.2-8-3.8 3.8-.6 6.1-1.9 8.2-4 2-2.1 3.2-4.4 3.8-8z" />
    </svg>
  );
}

// TODO(backend): swap this out once /api/incidents/{id}/chat exists and the
// Tachyon connection is wired up server-side. Signature stays the same.
async function askIncidentQuestion(
  apiBaseUrl: string,
  incidentNumber: string,
  question: string
): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/api/incidents/${encodeURIComponent(incidentNumber)}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    throw new Error(`Chat request failed with status ${res.status}`);
  }
  const data = (await res.json()) as { answer: string };
  return data.answer;
}

export function IncidentChatSection({
  apiBaseUrl,
  incidentNumber,
  open,
  onOpenChange,
  onHasMessagesChange,
}: {
  apiBaseUrl: string;
  incidentNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Fires whenever the conversation transitions between empty and non-empty.
  // Lets a sibling (the AiSummaryCard, rendered above this component) react
  // to "has the first question been asked yet" — e.g. hiding its Send to
  // Teams button once a real conversation is underway.
  onHasMessagesChange?: (hasMessages: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset the conversation whenever a different incident is opened, so old
  // messages don't bleed into the next incident's chat.
  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [incidentNumber]);

  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const answer = await askIncidentQuestion(apiBaseUrl, incidentNumber, trimmed);
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch {
      setError("Couldn't get an answer just now — try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  // --- Collapsed teaser ---
  if (!open) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: c.surfaceContainerLow,
          border: `1px dashed ${c.outlineVariant}`,
          borderRadius: 4,
          padding: "14px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#ffeeec",
              color: c.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconChat size={16} />
          </span>
          <span style={{ fontFamily: fontBody, fontSize: 13, fontWeight: 600, color: c.onSurfaceVariant }}>
            Want to learn more about this incident?
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: c.primary,
            color: c.onPrimary,
            border: "none",
            padding: "8px 14px",
            borderRadius: 4,
            fontFamily: fontBody,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <IconChat size={13} />
          Ask a question
        </button>
      </div>
    );
  }

  // --- Expanded chat. Assumes its parent gives it a real, bounded height
  // (see the IncidentDetailPanel diff) — that's what lets the message list
  // scroll on its own while the input stays pinned at the bottom. ---
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontFamily: fontBody,
          fontSize: 11.5,
          fontWeight: 600,
          color: c.primary,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          width: "fit-content",
          flexShrink: 0,
        }}
      >
        <IconChevronLeft />
        Back to details
      </button>

      {messages.length === 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
          {STARTER_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              style={{
                fontFamily: fontBody,
                fontSize: 11,
                padding: "5px 10px",
                borderRadius: 999,
                border: `1px solid ${c.outlineVariant}`,
                background: c.surface,
                color: c.onSurfaceVariant,
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  maxWidth: "80%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  borderTopRightRadius: 2,
                  background: c.primary,
                  color: c.onPrimary,
                  fontFamily: fontBody,
                  fontSize: 12.5,
                  lineHeight: "19px",
                }}
              >
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} style={{ display: "flex", gap: 7 }}>
              <span
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: "50%",
                  background: c.tertiaryContainer,
                  color: c.secondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconSparkleSmall />
              </span>
              <div
                style={{
                  maxWidth: "80%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  borderTopLeftRadius: 2,
                  background: c.surfaceContainerLow,
                  border: `1px solid ${c.outlineVariant}`,
                  color: c.onSurface,
                  fontFamily: fontBody,
                  fontSize: 12.5,
                  lineHeight: "19px",
                }}
              >
                {m.text}
              </div>
            </div>
          )
        )}
        {sending && (
          <div style={{ fontFamily: fontBody, fontSize: 12, color: c.onSurfaceVariant, paddingLeft: 28 }}>
            Thinking…
          </div>
        )}
        {error && <div style={{ fontFamily: fontBody, fontSize: 12, color: c.errorText }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: `1px solid ${c.outlineVariant}`, paddingTop: 10, flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: `1.5px solid ${c.outlineVariant}`,
            borderRadius: 8,
            padding: "7px 9px",
          }}
        >
          <input
            type="text"
            value={input}
            placeholder="Ask about this incident..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send(input);
            }}
            disabled={sending}
            style={{
              border: "none",
              outline: "none",
              fontSize: 12.5,
              flex: 1,
              minWidth: 0,
              background: "transparent",
              fontFamily: fontBody,
            }}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            style={{
              background: c.primary,
              border: "none",
              borderRadius: 6,
              width: 27,
              height: 27,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: c.onPrimary,
              cursor: sending || !input.trim() ? "default" : "pointer",
              opacity: sending || !input.trim() ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            <IconSend />
          </button>
        </div>
        <p style={{ fontFamily: fontBody, fontSize: 10, color: "#9aa2b1", margin: "6px 2px 0" }}>
          Answers are generated from this incident's data and may be imperfect.
        </p>
      </div>
    </div>
  );
}
