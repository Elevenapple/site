# MCP server

`https://paprikaf.com/api/mcp` — read-only, unauthenticated, Streamable HTTP.

It answers questions about Ahmed's work from the same approved claim set the
website and the role-fit brief already use. Everything it can return is already
published on the site, which is why it needs no OAuth.

## Connect

The homepage hero offers four one-line ways in: a prompt, the Claude Code
command, the skill, and this URL. This section has the steps for each client.
The client labels were checked against each vendor's docs in September 2026.
ChatGPT renamed Connectors to Apps in December 2025 and to Plugins in July
2026, so expect these labels to change again.

**Claude** (web and desktop, any plan; Free allows one custom connector):
open **Customize → Connectors**, click **+**, choose **Add custom connector**,
name it `paprikaf`, and paste the URL. In a chat, switch it on from
**+ → Connectors**.
[Help article](https://support.claude.com/en/articles/11175166).

**ChatGPT** (web; Plus, Pro, Business, Enterprise, and Edu; on Business and
Enterprise an admin has to allow developer mode first): open
**Settings → Security and login** and turn on **Developer mode**. On the
[Plugins](https://chatgpt.com/plugins) page, click **+**, name the app
`paprikaf`, paste the URL, and choose **No Authentication**. In a chat, open
**+ → Developer mode** and select it.
[Developer mode guide](https://developers.openai.com/api/docs/guides/developer-mode).

**Claude Code.** The default scope covers only the current project, so pass
`-s user` to make the server available in every project:

```bash
claude mcp add -s user -t http paprikaf https://paprikaf.com/api/mcp
```

**Codex.** The CLI, the IDE extension, and the ChatGPT desktop app share this
config:

```bash
codex mcp add paprikaf --url https://paprikaf.com/api/mcp
```

**Gemini CLI:**

```bash
gemini mcp add --transport http paprikaf https://paprikaf.com/api/mcp
```

**Cursor**, in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "paprikaf": {
      "url": "https://paprikaf.com/api/mcp"
    }
  }
}
```

**VS Code**, in `.vscode/mcp.json`. VS Code reads `servers`, not
`mcpServers`:

```json
{
  "servers": {
    "paprikaf": {
      "type": "http",
      "url": "https://paprikaf.com/api/mcp"
    }
  }
}
```

**Any other client:** Streamable HTTP, with no auth and no headers.

### Without MCP

- **Prompt.** Any assistant that can open a page can start from
  `Read paprikaf.com/llms.txt and tell me what Ahmed has built`.
- **Skill.** `npx skills add paprikaf/site --skill paprikaf` installs
  [`skills/paprikaf/SKILL.md`](../skills/paprikaf/SKILL.md). It tells an agent
  where the evidence lives and what not to overclaim. Pass `--skill`, because
  the repo also vendors the vgpu skill.

## Tools

| Tool           | Purpose                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `get_profile`  | Entry point. Projects with public artifacts plus the capability index. |
| `search_work`  | Approved claims matching a keyword, with source links and caveats.     |
| `get_project`  | Every claim and public link for one `projectId`.                       |
| `compare_role` | The role-fit brief for a pasted job description. Rate limited.         |
| `search`       | ChatGPT compatibility. Same corpus, OpenAI's result shape.             |
| `fetch`        | ChatGPT compatibility. One record by id.                               |

## Prompts

| Prompt      | What it starts                                                      |
| ----------- | ------------------------------------------------------------------- |
| `overview`  | A sourced summary of the public work, and what the evidence misses. |
| `check_fit` | Asks for a job description, then runs `compare_role` on it.         |

Claude Code lists them as `/paprikaf:overview` and `/paprikaf:check_fit`.
Neither takes arguments, because Claude Code splits prompt arguments on
whitespace and a job description would arrive as its first word.

## Server instructions

The `instructions` string puts the rules against overclaiming before the tool
order. ChatGPT asks for the first 512 characters to make sense on their own,
and a test holds the rules inside that window.

Every tool is annotated `readOnlyHint: true`. `get_profile` is deliberately
compact — a few hundred tokens — because it is the first call an agent makes.
Depth comes from `search_work` and `get_project` once the agent knows the
question it is answering.

## ChatGPT compatibility

ChatGPT's deep research and company-knowledge modes retrieve only through a tool
pair named exactly `search` and `fetch`. The names and shapes are OpenAI's:

- `search({ query })` returns `{ results: [{ id, title, url }] }`.
- `fetch({ id })` returns `{ id, title, text, url, metadata }`.
- Both return that payload **twice**: as `structuredContent`, and as a
  JSON-encoded string in `content[0].text`. Returning only one of the two makes
  the connector look empty in ChatGPT.

`id` accepts a claim id, a project id, or `profile`. The `url` on each result
prefers an independent public record over Ahmed's own portfolio page, because
that url is what ChatGPT cites — a link to the artifact is stronger evidence
than a link back to the claim about it.

Developer mode in ChatGPT accepts arbitrary tools, so the other four work there
too. The pair exists for the retrieval-only modes, which ignore everything else.

## Resources

`paprikaf://evidence/claims` returns the whole approved claim bundle as JSON,
for a client that would rather load the corpus than call tools.

## Why this is hand-rolled

Vercel documents `mcp-handler` for this, but that package peer-depends on
Next.js `>=13` and this site is a Vite SPA with Vercel Functions. The endpoint
is stateless and read-only, which is the subset of the Streamable HTTP
transport that needs no session store and no SSE:

- `POST` carrying one JSON-RPC request returns one `application/json` response.
- `POST` carrying a notification or a response returns `202 Accepted`.
- `GET` and `DELETE` return `405`, which the transport spec allows for a server
  that offers no server-initiated stream and keeps no sessions.
- No `Mcp-Session-Id` is issued, so clients need not track one.
- `MCP-Protocol-Version` is validated when present and echoed on the response.
  Supported: `2025-06-18`, `2025-03-26`, `2024-11-05`.

That is roughly 300 lines in `server/mcp/`, with no new runtime dependency.

## Safety boundaries

- The corpus is `content/approved-claims.json`, where every entry is
  `public: true`. Private Slack, Granola, customer, and repository evidence
  never enters the deployed dataset, so there is nothing for the endpoint to
  leak.
- A submitted role description is untrusted input. The generation system prompt
  treats it as data only, and `sanitizeRoleText` strips markup and control
  characters before it reaches the model.
- `compare_role` is metered per client address with its own limiter, separate
  from `/api/fit`, so website traffic and agent traffic cannot starve each
  other. The free lookups stay available to a client that exhausts the quota.
- CORS is open because the data is public and no credential is involved.

## Local development

`vite dev` serves the SPA but not the `api/` functions. To exercise the
endpoint locally, wrap the handler in a Node server and POST JSON-RPC to it, or
run `vercel dev`.

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Tests live in `tests/mcp/handler.test.ts` and cover the transport rules, each
tool, rate limiting, and the public-only guarantee.
