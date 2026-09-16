import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export const MCP_ENDPOINT = 'https://paprikaf.com/api/mcp';

type ConnectOption = {
  id: string;
  label: string;
  hint: string;
  snippet: string;
};

const OPTIONS: ConnectOption[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    hint: 'Run this once in any project.',
    snippet: `claude mcp add --transport http paprikaf ${MCP_ENDPOINT}`,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    hint:
      'Turn on Developer mode in ChatGPT settings, then add a custom connector ' +
      'with this URL. Deep research and company knowledge retrieve through the ' +
      'search and fetch tools.',
    snippet: MCP_ENDPOINT,
  },
  {
    id: 'mcp-json',
    label: 'Cursor · VS Code',
    hint: 'Add to your MCP config file.',
    snippet: `{
  "mcpServers": {
    "paprikaf": {
      "url": "${MCP_ENDPOINT}"
    }
  }
}`,
  },
  {
    id: 'url',
    label: 'Anything else',
    hint: 'Streamable HTTP. No key, no sign-in.',
    snippet: MCP_ENDPOINT,
  },
];

export function McpConnect() {
  const [activeId, setActiveId] = useState(OPTIONS[0].id);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = OPTIONS.find((option) => option.id === activeId) ?? OPTIONS[0];

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(active.snippet);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mcp" id="mcp" aria-labelledby="mcp-title">
      <div className="mcp__intro">
        <p className="eyebrow">MCP / AGENTS</p>
        <div>
          <h2 id="mcp-title">Or ask from your own tools.</h2>
          <p>
            This site runs a read-only MCP server over the same public evidence.
            Point Claude Code, ChatGPT, Cursor, or any MCP client at it and ask
            about my work there instead of reading this page.
          </p>
        </div>
      </div>

      <div className="mcp__panel">
        <div className="mcp__tabs" role="tablist" aria-label="Install options">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              id={`mcp-tab-${option.id}`}
              aria-selected={option.id === activeId}
              aria-controls={`mcp-panel-${option.id}`}
              className={
                option.id === activeId ? 'mcp__tab is-active' : 'mcp__tab'
              }
              onClick={() => {
                setActiveId(option.id);
                setCopied(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className="mcp__snippet"
          role="tabpanel"
          id={`mcp-panel-${active.id}`}
          aria-labelledby={`mcp-tab-${active.id}`}
        >
          <pre>
            <code>{active.snippet}</code>
          </pre>
          <button type="button" onClick={handleCopy} className="mcp__copy">
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <p className="mcp__hint">{active.hint}</p>

        <ul className="mcp__tools" aria-label="Available tools">
          <li>
            <span>get_profile</span>
            Projects with public artifacts, and what each capability is backed
            by.
          </li>
          <li>
            <span>search_work</span>
            Claims matching a capability or technology, with source links and
            caveats.
          </li>
          <li>
            <span>get_project</span>
            Every claim and public link for one project.
          </li>
          <li>
            <span>compare_role</span>
            The same role comparison as above, run from your client.
          </li>
        </ul>
      </div>
    </section>
  );
}
