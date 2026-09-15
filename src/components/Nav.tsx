import { useEffect, useId, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Link, useLocation } from '@tanstack/react-router';
import { publicLinks } from '@/data/portfolio';

export function Nav() {
  const location = useLocation();
  const onHome = location.pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const workHref = onHome ? '#work' : '/#work';
  const roleFitHref = onHome ? '#role-fit' : '/#role-fit';
  const experienceHref = onHome ? '#experience' : '/#experience';

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <div className="site-nav__inner">
        <Link
          className="site-nav__brand"
          to="/"
          aria-label="Ahmed Felfel, home"
          onClick={closeMenu}
        >
          <img
            className="site-nav__mark"
            src="/brand-mark.png"
            alt=""
            width={38}
            height={38}
          />
          <span>
            Ahmed Felfel
            <small>0→1 Product Engineer</small>
          </span>
        </Link>

        <div className="site-nav__links">
          <a href={workHref}>Work</a>
          <a href={roleFitHref}>Role fit</a>
          <a className="site-nav__experience" href={experienceHref}>
            Experience
          </a>
          <Link to="/resume">Résumé</Link>
          <a className="site-nav__contact" href={publicLinks.email}>
            Contact <ArrowUpRight aria-hidden="true" />
          </a>
        </div>

        <button
          type="button"
          className="site-nav__menu-toggle"
          aria-expanded={menuOpen}
          aria-controls={panelId}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          <span>{menuOpen ? 'Close' : 'Menu'}</span>
        </button>
      </div>

      <div
        id={panelId}
        className={`site-nav__panel${menuOpen ? ' is-open' : ''}`}
        hidden={!menuOpen}
      >
        <a href={workHref} onClick={closeMenu}>
          Work
        </a>
        <a href={roleFitHref} onClick={closeMenu}>
          Role fit
        </a>
        <a href={experienceHref} onClick={closeMenu}>
          Experience
        </a>
        <Link to="/resume" onClick={closeMenu}>
          Résumé
        </Link>
        <a href={publicLinks.email} onClick={closeMenu}>
          Contact <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </nav>
  );
}
