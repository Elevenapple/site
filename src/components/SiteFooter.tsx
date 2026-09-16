import { publicLinks } from '@/data/portfolio';

const BUILD_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function buildDate(): string | null {
  const parsed = new Date(__BUILD_TIME__);
  return Number.isNaN(parsed.getTime())
    ? null
    : BUILD_DATE_FORMATTER.format(parsed);
}

export function SiteFooter() {
  const sha = __BUILD_SHA__;
  const date = buildDate();

  return (
    <footer className="site-footer">
      <p className="site-footer__build">
        {sha ? (
          <>
            <span>Built from</span>
            <a
              className="site-footer__sha"
              href={`${publicLinks.repo}/commit/${sha}`}
              target="_blank"
              rel="noreferrer"
            >
              {sha}
            </a>
          </>
        ) : (
          <span>Built locally</span>
        )}
        {date ? <span>on {date}</span> : null}
      </p>

      <p>
        <a href={publicLinks.repo} target="_blank" rel="noreferrer">
          Source
        </a>
        {' · '}
        <a href="/llms.txt">llms.txt</a>
        {' · '}
        <a href={publicLinks.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </p>
    </footer>
  );
}
