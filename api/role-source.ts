import { handleRoleSourceRequest } from '../server/role-fit/url-handler.js';

export async function POST(request: Request): Promise<Response> {
  return handleRoleSourceRequest(request);
}
