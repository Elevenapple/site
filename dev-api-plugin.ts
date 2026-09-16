import type { Plugin } from 'vite';

/**
 * Serve the `api/` Vercel Functions during `vite dev`.
 *
 * Vite only serves the SPA, so without this the role-fit, role-source, and MCP
 * endpoints exist in production and nowhere else, and the only way to exercise
 * them locally is `vercel dev` or a hand-rolled server. Dev only — production
 * is served by Vercel, which routes `api/` itself.
 */
export function devApiPlugin(): Plugin {
  const routes: Record<string, string> = {
    '/api/fit': './api/fit.ts',
    '/api/mcp': './api/mcp.ts',
    '/api/role-source': './api/role-source.ts',
  };

  return {
    name: 'paprikaf-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const modulePath = routes[path];

        if (!modulePath) {
          next();
          return;
        }

        try {
          const module = (await server.ssrLoadModule(modulePath)) as Record<
            string,
            ((request: Request) => Promise<Response>) | undefined
          >;
          const handler = module[req.method ?? 'GET'];

          if (!handler) {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'method not allowed' }));
            return;
          }

          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = Buffer.concat(chunks);

          const host = req.headers.host ?? 'localhost';
          const request = new Request(`http://${host}${req.url ?? '/'}`, {
            method: req.method,
            headers: Object.entries(req.headers).flatMap(([key, value]) =>
              typeof value === 'string'
                ? [[key, value] as [string, string]]
                : []
            ),
            ...(body.length > 0 ? { body } : {}),
          });

          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: {
                code: 'dev-handler-failed',
                message: error instanceof Error ? error.message : 'unknown',
              },
            })
          );
        }
      });
    },
  };
}
