import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../../components/Icon";
import { ApiError } from "../../api/client";
import { getIncidentDetail } from "../../api/incidents";
import type { IncidentDetail } from "../../types";
import { formatDuration, formatOpenedAt } from "../../utils/format";
import { PriorityBadge, StatusIndicator } from "./badges";

interface IncidentDetailModalProps {
  incidentNumber: string;
  onClose: () => void;
}

const ANIMATION_MS = 200;

function formatTimelineTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function IncidentDetailModal({ incidentNumber, onClose }: IncidentDetailModalProps) {
  // `visible` drives the enter/exit transform+opacity transition; `entered`
  // gates the very first paint so the panel always starts from the
  // "closed" state before animating open (avoids a flash at full size).
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  function requestClose() {
    setVisible(false);
    window.setTimeout(onClose, ANIMATION_MS);
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);

    getIncidentDetail(incidentNumber)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? `Incident ${incidentNumber} could not be found.`
            : "Could not load incident details."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [incidentNumber]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-inverse-surface/50 transition-opacity duration-200 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={requestClose}
      role="presentation"
    >
      <div
        className={`bg-surface rounded-lg shadow-xl border border-outline-variant w-[80vw] h-[80vh] flex flex-col overflow-hidden transition-all duration-200 ease-out ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-modal-title"
      >
        {/* Header */}
        <div className="border-b border-outline-variant px-8 py-6 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2
                id="incident-modal-title"
                className="font-headline-md text-headline-md font-bold text-primary"
              >
                {incidentNumber}
              </h2>
              {detail && <PriorityBadge priority={detail.priority} />}
            </div>
            {detail && (
              <div className="flex items-center gap-4 text-on-surface-variant">
                <StatusIndicator status={detail.status} />
                <span className="font-body-md text-body-md">
                  Opened {formatOpenedAt(detail.opened_at)} · {formatDuration(detail.duration_minutes)} elapsed
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="text-on-surface-variant hover:text-primary transition-colors p-2 -m-2"
            aria-label="Close incident details"
          >
            <Icon name="close" className="text-[24px]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {!detail && !error && (
            <p className="text-on-surface-variant font-body-md text-body-md">Loading incident details…</p>
          )}
          {error && <p className="text-error font-body-md text-body-md">{error}</p>}

          {detail && (
            <div className="grid grid-cols-3 gap-gutter">
              {/* Key facts */}
              <div className="col-span-1 flex flex-col gap-5">
                <Fact label="MIM Engaged" value={detail.mim ? "Yes" : "No"} accent={detail.mim} />
                <Fact label="Causal CIO" value={detail.causal_cio} />
                <Fact label="Impacted Business" value={detail.impacted_biz} />
                <Fact label="Incident Commander" value={detail.incident_commander} />

                {detail.bridge_url && (
                  <a
                    href={detail.bridge_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container py-2.5 rounded font-label-md text-label-md uppercase tracking-wider hover:bg-primary transition-colors shadow-sm"
                  >
                    <Icon name="call" className="text-[18px]" />
                    Join Bridge
                  </a>
                )}
              </div>

              {/* Description + timeline */}
              <div className="col-span-2 flex flex-col gap-8">
                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
                    Summary
                  </p>
                  <p className="font-body-lg text-body-lg text-on-background">{detail.description}</p>
                </div>

                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">
                    Timeline
                  </p>
                  <ol className="flex flex-col gap-5">
                    {detail.updates.map((entry, index) => (
                      <li key={index} className="flex gap-4">
                        <div className="flex flex-col items-center pt-1">
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          {index < detail.updates.length - 1 && (
                            <span className="w-px flex-1 bg-outline-variant mt-1" />
                          )}
                        </div>
                        <div className="pb-1">
                          <p className="font-label-md text-label-md text-on-surface-variant">
                            {formatTimelineTimestamp(entry.timestamp)} · {entry.author}
                          </p>
                          <p className="font-body-md text-body-md text-on-background mt-1">{entry.note}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Fact({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-body-lg text-body-lg ${accent ? "text-error font-semibold" : "text-on-background"}`}>
        {value}
      </p>
    </div>
  );
}
