# Portfolio content system

Last verified: 2026-08-27

This is the public-safe editorial guide for Ahmed Felfel’s portfolio. Approved
machine-readable claims also ship at [`public/evidence.md`](public/evidence.md).
Private repository findings and meeting context live under the git-ignored
`context/` directory and must never be published automatically.

## Positioning

**Functional identity:** 0→1 Product Engineer

**Current official title:** GTM Engineer at Builder.io

**Core line:**

> I build products from scratch. I am a GTM Engineer at Builder.io, where I
> build learning software, developer tools, and internal AI systems.

## How to present the Builder.io role changes

Present the Builder.io tenure as one company and three stages:

> Builder.io · 2023—present  
> Customer Engineer → Partner Enablement Engineer → GTM Engineer

The public explanation is factual:

> I joined Builder.io as a Customer Engineer, moved into partner enablement, and
> now work in GTM engineering. In each role, I ended up building software for
> problems I saw firsthand.

Do not invent a cleaner official title history. “0→1 Product Engineer” is the
functional headline; the official titles remain visible underneath it.

For the résumé, use one Builder.io entry rather than three disconnected jobs.
Lead with the current role—GTM Engineer on RevOps—then show the title progression
on one line. Internal evidence places the move into Partner Enablement in
December 2024 and the formal move into GTM Engineering in March 2026. Do not add
month-level dates publicly without checking the HR record.

## Ownership language

- **Builder Academy:** Built Builder Academy and owned its application
  engineering from the start. Enablement and content teammates contributed
  later.
- **Builder CMS MCP Server:** Built and launched the initial production
  implementation
- **Internal AI tools for GTM:** Current work; internal system
- **Agent Native:** Contributor
- **Nomad:** Building; public and early; built on Agent Native
- **@crate.ai/discogs-sdk:** Creator and maintainer
- **Galite:** Now building; public and early

Prefer ownership, scope, public links, and concrete decisions over unsupported
metrics. Do not imply sole ownership of products now maintained by a broader
team.

## Content format

The MVP does not have a Writing section or polished case studies. Ahmed does not
need to perform as a professional writer to prove that he builds products.

Deeper project pages, if added later, should be short build records with three
fields: what the product is, what Ahmed did, and its current status. Add links,
screenshots, diagrams, or code when they prove something useful. Do not invent
an origin story, a tidy framework, or a generic lesson learned.

## Résumé language supported by internal evidence

Internal Slack and meeting evidence supports using stronger verbs without
publishing the private sources themselves:

- **Builder Academy:** Built Builder Academy and owned the application
  engineering for onboarding and learner progress from the start. Enablement
  and content teammates contributed later. Ahmed later documented the codebase
  for handoff.
- **Builder CMS MCP Server:** Built and launched the initial production
  implementation for agent-driven schema discovery and CMS create/update
  workflows before it grew into a broader team-owned product.
- **Internal AI tools for GTM:** Owned internal agents and rep workflows from
  prototype through live testing, including human review and evaluation loops.
- **Customer Engineering:** Led technical onboarding and unblock work, then
  turned recurring customer friction into reusable enablement and product
  systems.

Keep internal app names, customer identities, direct Slack quotations, private
metrics, and implementation details out of the public résumé unless Builder
approves them.

## Primary audience

Founders, engineering leaders, and hiring managers with an ambiguous 0→1
product problem. The site should earn a human conversation by showing that
Ahmed can learn the workflow, ship the first useful version, and stay through
operation and handoff.

## Exa concept: Find the overlap

The useful Exa feature is not a generic résumé chatbot. A visitor supplies a
public company URL, role description, or hard workflow. Exa researches that
public context, and the site matches it against only the approved claims in
`public/evidence.md` to produce a cited relevance brief:

1. What appears to matter in the visitor’s context
2. The two or three most relevant things Ahmed has built
3. What Ahmed actually owned
4. How he would begin
5. A human next step

The feature stays out of the static MVP until it has a server-only key, input
limits, citations, rate limits, and an allowlist of approved claim IDs. It must
never receive private meeting notes, internal repository context, customer
data, or unpublished metrics.

## Open editorial checks

- Ahmed’s preferred public email address, if any
- Precise opportunity constraints
- Approved outcome evidence for Builder Academy
- Approved public boundaries for internal GTM work
- Real-world usage evidence for the Discogs SDK
- The first Galite loop that works with real data
- Collaborator credits for each Builder project claim
