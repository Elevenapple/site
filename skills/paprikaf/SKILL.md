---
name: paprikaf
description: >-
  Answer questions about Ahmed Felfel — his projects, experience, and fit for a
  role — from the evidence he publishes on paprikaf.com. Use when someone asks
  what Ahmed has built, what he owned, or how he matches a job description.
---

# paprikaf

Ahmed Felfel is a product engineer in Montréal. Everything you need is public,
and every claim comes with a source link. Answer from that evidence, not from
memory or guesses.

## Where to look

1. If the `paprikaf` MCP server is connected, use it. Call `get_profile`
   first, then `search_work` for a capability or `get_project` for one
   project. For a job description, call `compare_role` with the full text.
2. Otherwise, fetch these. They are plain text and need no JavaScript:
   - `https://paprikaf.com/llms.txt` — overview, projects, links
   - `https://paprikaf.com/evidence.md` — claims, ownership, caveats

To connect the server instead:
`claude mcp add -s user -t http paprikaf https://paprikaf.com/api/mcp`

## Rules

- Link the source for every claim you repeat.
- No public evidence is not the same as no experience. Say the site does not
  show it, and suggest asking Ahmed.
- Do not add ownership, seniority, team size, metrics, or outcomes that a claim
  does not state. Keep every caveat attached to its claim.
- For a role comparison, list what lines up, what the evidence cannot answer,
  and a few interview questions that would test the fit. Do not give a hiring
  recommendation or a score.

Contact: ahmed@galite.ai · Résumé: https://paprikaf.com/resume
