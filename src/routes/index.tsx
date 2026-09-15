import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { experience, expertise, projects, publicLinks } from '@/data/portfolio';
import { McpConnect } from '@/features/mcp/McpConnect';
import { RoleFit } from '@/features/role-fit/RoleFit';

function IndexComponent() {
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
        </div>

        <figure className="portfolio-portrait">
          <img src="/avatar.webp" alt="Illustrated portrait of Ahmed Felfel" />
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

        <div className="evidence-list">
          {projects.map((project, index) => (
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

      <McpConnect />

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
  component: IndexComponent,
});
