import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { experience, expertise, projects, publicLinks } from '@/data/portfolio';
import {
  countByFacet,
  filterProjects,
  parseFacets,
  serializeFacets,
  toggleFacet,
  WORK_FACET_LABELS,
  WORK_FACETS,
  type WorkFacet,
} from '@/features/work/facets';
import {
  AgentAccess,
  PortraitGlint,
} from '@/features/agent-access/AgentAccess';
import {
  DEFAULT_AGENT_WAY,
  type AgentWayId,
} from '@/features/agent-access/ways';
import { RoleFit } from '@/features/role-fit/RoleFit';

function IndexComponent() {
  const navigate = useNavigate({ from: '/' });
  const { work } = Route.useSearch();
  const selected = parseFacets(work);
  const counts = countByFacet(projects);
  const visible = filterProjects(projects, selected);
  const [agentWay, setAgentWay] = useState<AgentWayId>(DEFAULT_AGENT_WAY);
  const [glint, setGlint] = useState(0);
  const catchLight = () => setGlint((count) => count + 1);

  // replace, not push, so filtering does not fill the back button with steps
  // between a visitor and the page they arrived from.
  const setFacets = (next: WorkFacet[]) => {
    void navigate({
      search: { work: serializeFacets(next) },
      replace: true,
      resetScroll: false,
    });
  };

  return (
    <div className="portfolio-page">
      <section className="portfolio-hero" aria-labelledby="portfolio-title">
        <div className="portfolio-hero__copy">
          <p className="eyebrow">AHMED FELFEL / MONTRÉAL</p>
          <h1 id="portfolio-title">I build products from scratch.</h1>
          <p className="portfolio-hero__lede">
            I’m a GTM Engineer at Builder.io. I’ve built learning software,
            developer tools, and internal AI systems.
          </p>

          <div className="portfolio-hero__actions">
            <a className="button-link button-link--primary" href="#work">
              View my work <ArrowDownRight aria-hidden="true" />
            </a>
            <Link className="text-link" to="/resume">
              View résumé <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>

          <AgentAccess
            way={agentWay}
            onWayChange={(next) => {
              setAgentWay(next);
              catchLight();
            }}
            onCopy={catchLight}
          />
        </div>

        <figure className="portfolio-portrait">
          <div className="portfolio-portrait__frame">
            <img
              src="/avatar.webp"
              alt="Illustrated portrait of Ahmed Felfel"
            />
            <PortraitGlint pulse={glint} />
          </div>
          <figcaption>
            <span>Current role</span>
            <strong>GTM Engineer at Builder.io</strong>
          </figcaption>
        </figure>
      </section>

      <section className="work-preview" id="work" aria-labelledby="work-title">
        <header className="section-heading">
          <p className="eyebrow">SELECTED WORK</p>
          <h2 id="work-title">Products and tools I’ve built.</h2>
          <p>My role and where each project stands today.</p>
        </header>

        <div className="work-filter" role="group" aria-label="Filter work">
          <button
            type="button"
            className="work-filter__chip"
            aria-pressed={selected.length === 0}
            onClick={() => setFacets([])}
          >
            All work <span>{projects.length}</span>
          </button>
          {WORK_FACETS.map((facet) => (
            <button
              key={facet}
              type="button"
              className="work-filter__chip"
              aria-pressed={selected.includes(facet)}
              onClick={() => setFacets(toggleFacet(selected, facet))}
            >
              {WORK_FACET_LABELS[facet]} <span>{counts[facet]}</span>
            </button>
          ))}
        </div>

        <div className="evidence-list">
          {visible.map((project, index) => (
            <article className="evidence-row" key={project.id}>
              <div className="evidence-row__label">
                <span>{project.ownership}</span>
                <span>{project.organization}</span>
                <span>0{index + 1}</span>
              </div>
              <div className="evidence-row__story">
                <h3>{project.title}</h3>
                <p>{project.summary}</p>
                <ul aria-label={`${project.title} scope`}>
                  {project.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </div>
              <div className="evidence-row__links">
                {project.links.length > 0 ? (
                  project.links.map((link) => (
                    <a
                      href={link.href}
                      key={link.href}
                      target={
                        link.href.startsWith('http') ? '_blank' : undefined
                      }
                      rel={
                        link.href.startsWith('http') ? 'noreferrer' : undefined
                      }
                    >
                      {link.label} <ArrowUpRight aria-hidden="true" />
                    </a>
                  ))
                ) : (
                  <span className="evidence-row__private">INTERNAL SYSTEM</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <RoleFit />

      <section
        className="role-arc"
        id="experience"
        aria-labelledby="role-title"
      >
        <header className="role-arc__intro">
          <p className="eyebrow">EXPERIENCE</p>
          <h2 id="role-title">Where I’ve worked.</h2>
          <p>
            I joined Builder.io as a Customer Engineer, moved into partner
            enablement, and now work in GTM engineering. In each role, I ended
            up building software for problems I saw firsthand.
          </p>
        </header>

        <div className="experience-ledger">
          {experience.map((role, index) => (
            <article className="experience-row" key={role.company}>
              <div className="experience-row__number">0{index + 1}</div>
              <div>
                <p className="experience-row__period">{role.period}</p>
                <h3>{role.company}</h3>
              </div>
              <div className="experience-row__detail">
                <p className="experience-row__title">{role.title}</p>
                {role.roleProgression && (
                  <ol aria-label="Role progression">
                    {role.roleProgression.map((title) => (
                      <li key={title}>{title}</li>
                    ))}
                  </ol>
                )}
                <p>{role.summary}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="expertise-section"
        id="expertise"
        aria-labelledby="expertise-title"
      >
        <header>
          <p className="eyebrow">EXPERTISE</p>
          <h2 id="expertise-title">What I work on.</h2>
        </header>
        <div className="expertise-grid">
          {expertise.map((item) => (
            <article key={item.number}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
        <p className="technical-runway">
          TOOLS / React · TypeScript · Node · Convex · GCP · Terraform · Builder
          CMS · agent systems · MCP
        </p>
      </section>

      <section className="about-strip" id="about" aria-labelledby="about-title">
        <p className="eyebrow">OUTSIDE WORK</p>
        <div>
          <h2 id="about-title">I’m based in Montréal.</h2>
          <p>I DJ, ski, travel, and build music tools.</p>
          <a
            className="button-link button-link--primary about-strip__action"
            href={publicLinks.records}
            target="_blank"
            rel="noreferrer"
          >
            Listen to my records <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <section
        className="contact-section"
        id="contact"
        aria-labelledby="contact-title"
      >
        <p className="eyebrow">CONTACT</p>
        <h2 id="contact-title">Get in touch.</h2>
        <p>
          I’m interested in product engineering roles where I can build the
          first version and keep working on it after people start using it.
        </p>
        <div>
          <a
            className="button-link button-link--primary"
            href={publicLinks.email}
          >
            ahmed@galite.ai <ArrowUpRight aria-hidden="true" />
          </a>
          <a
            className="text-link"
            href={publicLinks.linkedin}
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn <ArrowUpRight aria-hidden="true" />
          </a>
          <a
            className="text-link"
            href={publicLinks.github}
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight aria-hidden="true" />
          </a>
          <Link className="text-link" to="/resume">
            Print-ready résumé <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export const Route = createFileRoute('/')({
  // Kept as the raw string so the URL reads ?work=built,building rather than a
  // JSON-encoded array. parseFacets is what turns it into trusted values.
  validateSearch: (search: Record<string, unknown>): { work?: string } => ({
    work: serializeFacets(parseFacets(search.work)),
  }),
  component: IndexComponent,
});
