import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { Nav } from '@/components/Nav';
import { SiteFooter } from '@/components/SiteFooter';

function RootComponent() {
  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Nav />
      <main id="main-content">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div className="not-found-page">
      <p className="eyebrow">404 / LOST SIGNAL</p>
      <h1>This route goes nowhere.</h1>
      <Link className="text-link" to="/">
        Return to the work
      </Link>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});
