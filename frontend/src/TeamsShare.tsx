import { useEffect, useRef, useState, type ReactNode } from "react";

// =============================================================================
// Teams "Send to" feature — recipient picker + button
//
// Usage (from your main dashboard file):
//   import { SendToTeamsButton } from "./TeamsShare";
//   <SendToTeamsButton text={someSummaryText} apiBaseUrl={apiBaseUrl} />
//
// Requires a backend route GET /api/people that returns:
//   [{ "name": "Scott Trebesch", "email": "scott.d.trebesch@wellsfargo.com" }, ...]
// =============================================================================

export interface Person {
  name: string;
  email: string;
}

async function getPeople(apiBaseUrl: string): Promise<Person[]> {
  const res = await fetch(`${apiBaseUrl}/api/people`);
  if (!res.ok) {
    throw new Error(`Request to /api/people failed with status ${res.status}`);
  }
  return (await res.json()) as Person[];
}

// Simple in-memory cache so the people directory isn't re-fetched every time
// a different incident's detail panel (and therefore a new SendToTeamsButton)
// mounts during the same session.
let peopleCache: Person[] | null = null;
let peopleCachePromise: Promise<Person[]> | null = null;

function getPeopleCached(apiBaseUrl: string): Promise<Person[]> {
  if (peopleCache) return Promise.resolve(peopleCache);
  if (!peopleCachePromise) {
    peopleCachePromise = getPeople(apiBaseUrl).then((list) => {
      peopleCache = list;
      return list;
    });
  }
  return peopleCachePromise;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function highlightMatch(name: string, query: string): ReactNode {
  if (!query) return name;
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <mark style={{ background: "#ffe8a3", color: "inherit", borderRadius: 2 }}>
        {name.slice(idx, idx + query.length)}
      </mark>
      {name.slice(idx + query.length)}
    </>
  );
}

function IconSend({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
    </svg>
  );
}

function IconCopy({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="11" height="11" rx="1" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </svg>
  );
}

// Builds a Teams deep link that opens a chat pre-filled with `message`. The
// user still has to hit Send inside Teams — this does not post automatically.
function buildTeamsChatLink(message: string, recipients?: string[]): string {
  const MAX_LEN = 1500; // Teams deep links get unreliable past ~1500-2000 chars
  const trimmed =
    message.length > MAX_LEN
      ? message.slice(0, MAX_LEN) + "… (truncated — see dashboard for full summary)"
      : message;

  const params = new URLSearchParams();
  if (recipients && recipients.length > 0) {
    params.set("users", recipients.join(","));
  }
  params.set("message", trimmed);

  return `https://teams.microsoft.com/l/chat/0/0?${params.toString()}`;
}

// Searchable recipient combobox: defaults to whatever `value` is passed in,
// opens into a directory dropdown on focus, filters as you type, and still
// accepts a typed email that isn't in the directory.
function RecipientPicker({
  apiBaseUrl,
  value,
  onChange,
}: {
  apiBaseUrl: string;
  value: string;
  onChange: (email: string) => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getPeopleCached(apiBaseUrl)
      .then((list) => {
        if (!cancelled) setPeople(list);
      })
      .catch(() => {
        /* non-fatal — picker just shows no suggestions, free-text still works */
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const query = value.trim().toLowerCase();
  const matches = query
    ? people.filter((p) => p.name.toLowerCase().includes(query) || p.email.toLowerCase().includes(query))
    : people;
  const exactMatch = people.some((p) => p.email.toLowerCase() === query);

  const selectedPerson = people.find((p) => p.email.toLowerCase() === value.trim().toLowerCase());
  const avatarLabel = selectedPerson
    ? getInitials(selectedPerson.name)
    : value.trim()
    ? value.trim()[0].toUpperCase()
    : "?";

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, minWidth: 180 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: `1.5px solid ${open ? "#464eb8" : "#c9cfda"}`,
          borderRadius: 8,
          padding: "6px 8px",
          background: "#fff",
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#464eb8",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {avatarLabel}
        </span>
        <input
          type="text"
          value={value}
          placeholder="Search people or type an email"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          style={{
            border: "none",
            outline: "none",
            fontSize: 12,
            flex: 1,
            minWidth: 0,
            background: "transparent",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        />
        <span style={{ fontSize: 10, color: "#8a93a6", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div
          style={{
            marginTop: 6,
            border: "1px solid #dfe3ea",
            borderRadius: 8,
            background: "#fff",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {matches.length > 0 ? (
            <>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#9aa2b1",
                  padding: "8px 12px 4px",
                }}
              >
                {query ? "Matches" : "Suggested"}
              </div>
              {matches.slice(0, 20).map((p) => (
                <div
                  key={p.email}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(p.email);
                    setOpen(false);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f2f3fb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#7a5900",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(p.name)}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1b1c1c" }}>
                      {highlightMatch(p.name, query)}
                    </span>
                    <span style={{ fontSize: 11, color: "#8a93a6" }}>{p.email}</span>
                  </div>
                </div>
              ))}
            </>
          ) : query ? (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#9aa2b1",
                padding: "8px 12px 4px",
              }}
            >
              No matches in directory
            </div>
          ) : null}

          {query && !exactMatch && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(value.trim());
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 12px",
                background: "#f7f8fb",
                cursor: "pointer",
                borderTop: matches.length > 0 ? "1px solid #eef0f3" : "none",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "1.5px dashed #9aa2b1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8a93a6",
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                +
              </span>
              <span style={{ fontSize: 12, color: "#4b5563" }}>
                Send to <b>{value.trim()}</b>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SendToTeamsButton({
  text,
  apiBaseUrl,
  defaultRecipient,
}: {
  text: string;
  apiBaseUrl: string;
  defaultRecipient?: string; // e.g. your own email, to default "send to self"
}) {
  const [recipient, setRecipient] = useState(defaultRecipient ?? "");
  const [copied, setCopied] = useState(false);

  const handleSend = async () => {
    const recipients = recipient.trim() ? [recipient.trim()] : undefined;
    const link = buildTeamsChatLink(text, recipients);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard blocked — link still opens, just without the safety net
    }
    const win = window.open(link, "_blank");
    window.setTimeout(() => {
      try {
        win?.close();
      } catch {
        // some browsers block script-closing — ignore
      }
    }, 1000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API blocked — user can still select/copy manually
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <RecipientPicker apiBaseUrl={apiBaseUrl} value={recipient} onChange={setRecipient} />
      <div style={{ display: "flex", gap: 8, paddingTop: 1 }}>
        <button
          onClick={handleSend}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: "#464eb8",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          <IconSend />
          Send to Teams
        </button>
        <button
          onClick={handleCopy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #ddd0a0",
            background: "#ffffff",
            color: "#6b5f3f",
            cursor: "pointer",
          }}
        >
          <IconCopy />
          {copied ? "Copied" : "Copy text"}
        </button>
      </div>
    </div>
  );
}
