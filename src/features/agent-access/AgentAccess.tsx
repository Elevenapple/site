import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ArrowUpRight, Check, Copy } from 'lucide-react';

import { AGENT_WAYS, getAgentWay, type AgentWayId } from './ways';

/**
 * Four ways to hand this site to an AI, under the hero. One row of names, one
 * line to copy. Anything longer belongs in docs/MCP_SERVER.md.
 */
export function AgentAccess({
  way,
  onWayChange,
  onCopy,
}: {
  way: AgentWayId;
  onWayChange: (next: AgentWayId) => void;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabRefs = useRef(new Map<AgentWayId, HTMLButtonElement>());
  const active = getAgentWay(way);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const select = (next: AgentWayId) => {
    setCopied(false);
    onWayChange(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.text);
      setCopied(true);
      onCopy();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const index = AGENT_WAYS.findIndex((entry) => entry.id === way);
    const last = AGENT_WAYS.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % AGENT_WAYS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + AGENT_WAYS.length) % AGENT_WAYS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;

    if (next === null) return;

    event.preventDefault();
    const nextId = AGENT_WAYS[next].id;
    select(nextId);
    tabRefs.current.get(nextId)?.focus();
  };

  return (
    <div className="agent-access" id="ask-your-ai">
      <div
        className="agent-access__tabs"
        role="tablist"
        aria-label="Ask your AI about my work"
      >
        {AGENT_WAYS.map((entry) => (
          <button
            key={entry.id}
            ref={(node) => {
              if (node) tabRefs.current.set(entry.id, node);
              else tabRefs.current.delete(entry.id);
            }}
            type="button"
            role="tab"
            id={`agent-tab-${entry.id}`}
            aria-selected={entry.id === way}
            aria-controls="agent-panel"
            tabIndex={entry.id === way ? 0 : -1}
            onClick={() => select(entry.id)}
            onKeyDown={handleKeyDown}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* Keyed so the light runs along the rule again on every switch. */}
      <div key={way} className="agent-access__rule" aria-hidden="true" />

      <div
        className="agent-access__panel"
        role="tabpanel"
        id="agent-panel"
        aria-labelledby={`agent-tab-${way}`}
      >
        <button
          type="button"
          className="agent-access__line"
          onClick={() => void copy()}
          title="Copy"
        >
          <span className="agent-access__text">{active.text}</span>
          <span className="agent-access__icon" aria-hidden="true">
            {copied ? <Check /> : <Copy />}
          </span>
          <span className="sr-only">{copied ? ', copied' : ', copy'}</span>
        </button>

        {active.note ? (
          <a
            className="agent-access__note"
            href={active.note.href}
            target="_blank"
            rel="noreferrer"
          >
            {active.note.label} <ArrowUpRight aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Light catching the sunglasses. It runs once on load and again whenever the
 * visitor switches or copies a line, so the portrait answers the row beside it.
 * The mask is two ellipses measured off the lenses in avatar.webp, in the 4:5
 * crop the portrait uses at every width.
 */
export function PortraitGlint({ pulse }: { pulse: number }) {
  return (
    <span
      key={pulse}
      className={
        pulse === 0 ? 'portrait-glint portrait-glint--intro' : 'portrait-glint'
      }
      aria-hidden="true"
    />
  );
}
