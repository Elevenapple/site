# UX craft library — Site Design

Last updated: 2026-09-15  
Purpose: nourish world-class UX judgment for paprikaf.com. Prefer primary sources; name _why_ something elevates.

## Canon (read / re-read)

### Taste & abundance

- **Emil Kowalski — Developing Taste** — https://emilkowal.ski/ui/developing-taste  
  Working software is table stakes under AI. Differentiator = brand, design, intuition, experience. Taste = trained instinct, not preference. Train by: (1) surround yourself with great work, (2) rationalize _why_ something feels great, (3) practice and seek critique. Anu Atluru: scarcity treasures tools; abundance treasures taste.
- **Emil Kowalski — Agents with Taste** — https://emilkowal.ski/ui/agents-with-taste  
  Taste transfers when you can articulate _why_. Package craft as strict agent skills (easing flowcharts, duration tables, typography rules, practical tips like `scale(0.95)` not `scale(0)`). Agents inherit median quality from encoded constraints — matches Linear “harness” thinking.

- **Jem Gold — Design Is How It Tastes** — https://superposition.jem.computer/design-is-how-it-tastes/ (Apr 2026)  
  Object-language (tokens, radii) vs encounter-language (felt reasons). DESIGN.md-style specs go bloodless when they only describe the artifact. Prefer sensation → visuals → system over system → visuals. Vibe as generative semantic layer above tokens; taste stays as judgment. Directly useful for how we write craft skills for agents.

- **Sekei / PG Gonni** — https://www.sekei.xyz/ · https://github.com/sekeidesign/sekei-xyz  
  Design-engineer craft: interface experiments, earned flourishes, reading Well-Designed / Articulating Design Decisions, writing-references on taste. Restraint (no gratuitous transitions); respect the user’s running session.

### AI-era product shape

- **Andrew Ambrosino (OpenAI Codex) × Lenny** — https://www.lennysnewsletter.com/p/openai-codex-lead-on-the-new-shape  
  Software cheaper to build → taste matters more. Ambition: best desktop app full stop. Roles collapse but eliminating roles entirely is a mistake. Zone defense for PMs when everyone can build. Home base coordinating ChatGPT/Codex/existing tools. Related: Nan Yu on taste ≠ only aesthetics; Jenny Wen on design process shift; Linear as craft reference.
- **Jenny Wen (Anthropic / Claude design) × Lenny** — https://www.lennysnewsletter.com/p/the-design-process-is-dead  
  Classic discovery → mock → iterate is obsolete. Designers must stay relevant beside engineers building with live models; taste/judgment remains the scarce skill.
- **Nan Yu / Linear Method** (summaries + Linear’s own writing)  
  Directness and speed (language and interaction). Extreme scope reduction. Good taste differentiates B2B. AI product = **harness** (instructions, context, constraints, workflow) so the _median_ user outcome is reliably good — not one-off miracles for experts. Agents assist; humans stay accountable. Encode constraints in tools/UI more than in prose prompts. https://linear.app/now/how-we-built-linear-agent
- **Case study factory (UX Essays)** — https://essays.uxdesign.cc/case-study-factory  
  Formulaic case-study theater can kill critical thinking — prefer real problem framing over template storytelling.

### Interaction craft (new this pass)

- **Rauno Freiberg — Novelty** — https://rauno.me/craft/novelty (Feb 2026)  
  Novelty is seasoning / an exclamation mark. Framework: ~90% familiar, ~10% novel. Frequency kills novelty (semantic satiation). Intent matters (games vs tools). Special moments (first login, microsites) earn flourish; high-frequency chrome does not. Takeaway: make most things familiar, do something unexpected.
- **Rauno Freiberg — Designing Depth** — https://rauno.me/craft/depth (Jul 2024)  
  Composition via layering (“dirty the frame”), blurred backdrops for Z-axis, choreography + stagger from nature (fish/birds), affordance through motion (Dock vs Control Centre). Depth is narrative structure, not decoration.
- **Rauno Freiberg — Invisible Details of Interaction Design** — https://rauno.me/craft/interaction-design (Jul 2023)  
  Deconstruct _why_ interactions feel right: metaphors, kinetic physics, when to trigger mid-gesture vs on release, spatial consistency, frequency vs novelty, fidgetability, Fitts’s Law. Taste training via slow-motion observation + naming mechanisms.
- **Rauno Freiberg — What will you ship?** — https://rauno.me/craft/vercel (Dec 2023)  
  Vercel homepage north stars: performance, constraint in visual flair, aesthetic bridging. Prefer invisible craft (speed, a11y, scannability) over pompous gimmicks. Visual rhythm: don’t stack high-novelty sections; progressive enhancement for shaders.

### Motion restraint

- **Emil Kowalski — You Don't Need Animations** — https://emilkowal.ski/ui/you-dont-need-animations  
  Purpose first. Frequency kills delight (Raycast opens with zero motion for a reason). Rare morphs can earn novelty; high-frequency chrome should stay still. Bad motion destroys trust.
- **Emil Kowalski — Good vs Great Animations** — https://emilkowal.ski/ui/good-vs-great-animations  
  Origin-aware motion (`transform-origin` from the trigger). Prefer custom easings; ease-out as default for entrances; ease-in-out for on-screen travel.
- **Blake Crosley — Motion Grammar** — https://blakecrosley.com/blog/motion-grammar-when-animation-earns-its-frames (Aug 2026)  
  Deletion test: if you can’t say what the animation _tells_ the user, cut it. Jobs: spatial continuity, confirmation, attention during change, latency mask. Duration bands (~100 / 150–200 / 250–300 / 300–400ms). `prefers-reduced-motion` as first-class.
- **Dayo Akinkuowo — Motion with intent** — https://www.madebydayo.co/writing/motion-with-intent  
  Budget: 60fps mid-range phone, reduced-motion fallbacks designed first, never block paint; pause offscreen/hidden canvases. Motion carries information or stays still.
- **bossadizenith — Knowing What Not to Animate** — https://micro.bossadizenith.me/writing/animations  
  Design engineering judgment ≠ max motion. Knowing how to animate is skill; knowing what _not_ to animate is craft.

### Brutalism / honesty peers (for elevating paprikaf neo)

- **Carl Barenbrug — Brutalist Web Design** — https://carlbarenbrug.com/brutalist-web-design  
  Less fancy-tool default motion; more structural honesty. Convenience traps (Webflow effect buttons → everything fades on scroll). Brutalism as antidote to peer-performance polish.
- **Blake Crosley — Brutalist Web Design Meets Beauty** — https://blakecrosley.com/blog/beauty-brutalism-design (Feb 2026)  
  Honesty + craft: strip decoration, keep precise hierarchy. Not paprikaf’s paper/ink/steel system, but useful peer for “elevate without pasting another aesthetic.”

### Typography

- **William Zujkowski — Remarque (typography-first)** — https://williamzujkowski.github.io/posts/2026-04-10-remarque-typography-first-design-system/ (Apr 2026)  
  Anti-dashboard defaults. Interface _is_ typography: strict 3-role font system (display / body / mono), ~17px body, ~46rem measure, self-hosted fonts. Role strictness beats shipping five faces and hoping.
- **Aaron Sagray — Colophon** — https://sagray.com/colophon  
  Refuse Inter-as-default (says nothing). Modular scale from one ratio; fluid body. Type choices _are_ the content on a design site.
- **Open Design — Typography craft rules** — https://github.com/nexu-io/open-design/blob/main/craft/typography.md  
  Agent-ready rules on top of any DESIGN.md: multiplicative scale, leading bands, letter-spacing (ALL CAPS `0.06–0.1em`; display negative tracking). Most reliable AI-slop tells live here.

### Personal-site / portfolio craft

- **Ani Dalal — Vibing this website into existence** — https://anidalal.com/posts/vibing-this-website-into-existence/  
  Write a short vision doc before Figma/code: what kind of thing, who it’s for, what would make _you_ use it. Journal/garden > gallery; update friction must stay lighter than Notion.
- **Abdulkader Safi — Tech dashboard → editorial** — https://abdulkadersafi.com/blog/i-redesigned-my-portfolio-from-tech-dashboard-to-editorial (Jun 2026)  
  Portfolio is a sample of taste. Dark cyan card grids read as template. North star: magazine/editorial, one accent, reject SaaS hero/stat blocks.
- **Blazej Mrozinski — Personal website like a product** — https://www.blazejmrozinski.com/blog/personal-site-as-product/ (Mar 2026)  
  Brochure sites die; product architecture (content as data, connected parts) keeps them alive. Relevant for evidence rows / role-fit as system, not isolated pages.
- **Frank Chimero — Everything Easy is Hard Again** — https://frankchimero.com/blog/2018/everything-easy/  
  No razzle-dazzle; follow the grain of the web; prefer clarity and legibility over optional complexity. Classic personal-site north star alongside Sekei restraint.
- **Frank Chimero — The Web’s Grain** — https://frankchimero.com/blog/2015/the-webs-grain/  
  Design _with_ the medium’s constraints (fluid stacks, text/image conflict) instead of fighting for blank-canvas control.

## Operating principles for paprikaf.com

1. **Elevate neobrutalism, don’t replace it** — paper/ink/steel, hard shadows, radius 0.
2. **Every flourish earns its place** — Kaari: every feature should earn.
3. **Name why** — hierarchy, contrast, spacing, motion restraint, a11y; no “make it pop.”
4. **Median visitor outcome** — homepage, resume, role-fit should feel sharp for a cold visitor, not only for Ahmed.
5. **Partner lanes** — Copy owns words; Design owns flair; QA owns function; Ops owns deploy.
6. **Study before swing** — on a new visual thread, re-ground in this library + Sekei briefly, then propose concrete before/after.

## Refresh cadence

When Exa/Parallel (or web) is available, add 1–2 new primary sources per month; never let SEO listicles displace the canon above.

Completed passes (2026-09-15): taste/AI-era · Rauno craft · motion restraint · brutalism peers · typography + personal-site portfolio craft.

## Curation tooling (2026-09-15)

- **Parallel CLI**: authenticated on Site Design’s computer; preferred for primary-source discovery.
- **Exa**: authenticated MCP `exa-authenticated` live (loads card secret). Prefer it over free `user-Exa`. Platform env sometimes mis-injects EXA_API_KEY as the Parallel key — card secret in box-secrets is source of truth.
