# How does Ahmed fit this role?

Status: implemented v1
Last reviewed: 2026-08-27

## Product decision

The first public AI feature is a one-shot role comparison, not a chatbot.

A visitor pastes a public job description. The site returns:

1. up to six important requirements found in the description;
2. matches to claims and links Ahmed has published for each supported
   requirement;
3. the requirements this site cannot answer; and
4. exactly three questions that help an interviewer verify the comparison.

The result never recommends hiring Ahmed, produces a fit score, or treats
missing public information as proof that Ahmed lacks experience.

## Why v1 was text-only

Pasted text proved the useful product loop with the smallest privacy and abuse
surface. Job links now work too, without Exa — see Job links below. The public corpus is
also small enough to fit in one model context, so v1 does not need embeddings, a
vector database, or a retrieval service.

This is still a small form of retrieval-augmented generation:

- the server loads every checked-in public claim;
- the model reads the role and selects requirement and claim IDs;
- the server rejects unknown IDs; and
- only server-owned claim wording, caveats, and links reach the page.

## Shipped architecture

```text
Visitor
  |
  | paste 250–12,000 characters
  v
React role-fit form
  |
  | POST /api/fit
  v
Vercel WAF rate limit + validate + normalize + same-origin check
  |
  v
Load all checked-in public claims
  |
  v
One schema-constrained Anthropic generation
  |  returns role requirements + relationship/claim/reason IDs
  v
Validate exact excerpts + IDs + complete requirement coverage
  |
  v
Server composes visible prose and hydrates canonical claims and links
  |
  v
Typed evidence brief in React
```

This is a fixed pipeline. The model has no tools, cannot browse, and cannot
choose another data source.

## Main files

- `content/approved-claims.json` — versioned claims Ahmed has chosen to publish
- `server/role-fit/evidence.ts` — corpus schema and lookup
- `server/role-fit/model-contract.ts` — IDs and role interpretation the model may
  return
- `server/role-fit/hydration.ts` — validation and server-authored visible prose
- `server/role-fit/validation.ts` — request limits and text normalization
- `server/role-fit/rate-limit.ts` — best-effort anonymous demo limit
- `server/role-fit/handler.ts` — HTTP boundary, safe errors, and privacy-safe
  diagnostics
- `api/fit.ts` — Vercel Function entry point
- `src/features/role-fit/RoleFit.tsx` — browser experience
- `tests/role-fit/` — deterministic corpus, validation, and hydration tests

## Evidence and provenance

Each public claim has a stable ID, a status, capabilities, sources, and
caveats. The current provenance labels distinguish:

- **Ahmed's own account** — a role, ownership, skill, education, language, or
  location claim Ahmed has published;
- **Public artifact** — a product, package, repository, or document that can be
  opened publicly;
- **Public contribution record** — a specific merged contribution attributed
  to Ahmed's public account; and
- **Public authorship record** — public package or repository authorship.

A live product link proves that the product exists. It does not independently
prove Ahmed's ownership. The UI shows both facts instead of blending them.

Only this checked-in corpus ships with the Function. Private Slack, Granola,
customer, repository, and meeting context is excluded.

## API contract

### Request

```http
POST /api/fit
Content-Type: application/json
Origin: https://paprikaf.com
```

```ts
type FitRequest = {
  input: {
    type: 'text';
    text: string;
  };
};
```

The server accepts 250–12,000 normalized characters and a request body large
enough for the worst-case UTF-8 representation of that text.

### Response

```ts
type FitBrief = {
  role: {
    title: string | null;
    company: string | null;
    sourceKind: 'text';
    requirements: Array<{
      id: string;
      label: string;
      sourceExcerpt: string;
      priority: 'required' | 'preferred' | 'inferred';
    }>;
  };
  summary: string;
  matches: Array<{
    requirementId: string;
    relationship: 'direct' | 'adjacent';
    rationale: string;
    evidence: FitEvidence[];
  }>;
  unknowns: Array<{
    requirementId: string;
    reason: 'no-public-evidence';
    explanation: string;
  }>;
  interviewQuestions: Array<{
    question: string;
    resolvesRequirementIds: string[];
    testsClaimIds: string[];
  }>;
  meta: {
    requestId: string;
    evidenceVersion: string;
    generatedAt: string;
  };
};
```

The model does not author visible claims, rationale, summaries, gap
explanations, questions, citations, or URLs. The server composes those fields
after validation from the role requirements and the canonical corpus.

## Job links

A visitor can paste a job posting URL instead of the description. The server
loads the page at `POST /api/role-source`, reduces it to text, and the client
puts that text in the textarea — visible and editable — rather than comparing it
straight away. The person sees what was pulled before it is used.

Two paths:

- **Greenhouse** publishes every posting through an open JSON API, so a
  `greenhouse.io/{board}/jobs/{id}` URL is read through
  `boards-api.greenhouse.io`, which returns the description with no page chrome.
- **Everything else** is fetched and stripped of markup. This works on
  server-rendered postings and returns nothing useful on client-rendered ones.

Extraction that yields less than the 250-character floor is reported as a
failure telling the person to paste instead. That matters more than the happy
path: handing the model an empty shell or a page of navigation chrome produces a
confident, wrong brief. Known dead ends are client-rendered boards (Ashby,
Workday) and anything behind a login (LinkedIn). Lever's public postings API no
longer responds, so there is no adapter for it.

Exa was not needed. A direct fetch costs nothing, adds no third-party
dependency, and keeps the failure modes legible.

### Fetching a visitor-supplied URL safely

Server-side fetching of a caller-chosen URL is server-side request forgery by
default, so `server/role-fit/url-guard.ts` gates every request:

- https only, and no credentials in the URL;
- the hostname is resolved first, and every returned address is checked against
  the private, loopback, link-local, carrier-grade-NAT, multicast, and reserved
  ranges, which is what keeps `169.254.169.254` out of reach;
- literal IP hosts are checked directly, since they skip DNS, including
  IPv4-mapped IPv6;
- redirects are followed by hand, at most three hops, re-validating each one, so
  a permitted host cannot redirect the request into a private address;
- responses are capped at 2 MB with a 9-second timeout, and only HTML, plain
  text, and JSON content types are accepted.

The endpoint is same-origin only, so it is not a public URL fetcher wearing this
deployment's address, and it has its own rate limiter separate from the
comparison budget.

## Generation boundary

The server sends the role description and every current public claim to the
Anthropic model configured by `FIT_MODEL` (default `claude-sonnet-4-6`). The
credential is server-only in `ANTHROPIC_API_KEY`.

The model may return only:

- role title and company, retained only when present in the pasted text;
- requirement IDs, priorities, and exact source excerpts (the server derives
  each visible label from the validated excerpt);
- match requirement IDs, relationship codes, and claim IDs; and
- unknown requirement IDs and reason codes.

Hydration fails closed when:

- an excerpt does not occur in the pasted description;
- a requirement or claim ID is unknown;
- IDs repeat;
- a requirement is omitted from both matches and unknowns;
- a requirement appears in both; or
- the structured output is malformed.

The request has a 20-second model timeout, a 1,200-token output limit, and at
most one provider retry. Browser cancellation propagates through the Vercel
Function.

## Privacy and abuse controls

- The page says plainly that the job description is sent to Anthropic.
- The site does not save the description or comparison.
- Responses use `Cache-Control: no-store`.
- Application code does not log request bodies or generated reports. Failure
  diagnostics contain only request ID, error class, HTTP status, and duration.
- The endpoint accepts same-origin JSON POST requests only.
- Vercel WAF limits `/api/fit` to three requests per IP every ten minutes before
  the request reaches the Function or model provider.
- Active markup, control characters, and bidirectional overrides are removed.
- The model receives no tools and the role is delimited as untrusted data.
- A warm Function instance allows five attempts per client address per hour.

The in-memory limit is explicitly a second, best-effort layer: serverless
instances do not share it. The project-level WAF rule is the durable public
rate limit. A provider budget remains a useful hard account-level ceiling.

## Browser states

The UI supports:

- empty and too-short input;
- loading with cancellation;
- success with edit and reset actions;
- invalid input, origin rejection, temporary limit, timeout, and provider
  failure; and
- keyboard focus and live-region announcements for validation and results.

The report uses **Mapped overlap** and **Related work**, never a number. It
renders every classified match (at most six) so the summary cannot count
evidence that the visitor cannot inspect. Every source label states what kind
of proof it is, and the disclosure identifies the result as AI-assisted.

## Verification

The v1 launch checks are:

- corpus schema and unique IDs;
- public-only records and HTTPS public sources;
- input size, Unicode, sanitization, and exact-origin behavior;
- exact excerpt validation;
- unknown and duplicate ID rejection;
- complete requirement coverage;
- server-side deterministic prose; and
- handler and limiter behavior at the HTTP boundary;
- a live request against the deployed Function.

The opt-in live semantic suite covers strong, partial, and poor overlap. Each
fixture records canonical claim IDs that should appear, claims that must not
appear, and minimum gaps that must remain visible. Run it deliberately with
`RUN_ROLE_FIT_EVALS=1 pnpm test -- tests/role-fit/live-semantic-evals.test.ts`;
the normal test suite skips the three paid provider calls.

## Explicitly deferred

- generic ask-me-anything chat
- follow-up conversations or saved reports
- embeddings, hybrid retrieval, or a vector database
- accounts, email capture, or PDF export
- private Slack, Granola, customer, meeting, or repository evidence
- headless-browser rendering for client-rendered job boards

## Revisit triggers

Add Exa only if pasted descriptions create meaningful friction. Add retrieval
only if the corpus grows beyond roughly 50 atomic claims or evaluations show
that full-corpus context hurts quality. Add durable storage only when content
must change without deployment or visitors need saved comparisons. Add headless
rendering only if client-rendered boards become a common enough dead end to be
worth the cost and the abuse surface.

## References

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Functions](https://vercel.com/docs/functions)
- [AI SDK structured output](https://ai-sdk.dev/docs/reference/ai-sdk-core/output)
- [Anthropic provider for AI SDK](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- [Exa Contents API](https://exa.ai/docs/reference/contents-api-guide)
- [Deploying MCP servers to Vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)
