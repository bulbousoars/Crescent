import type { NextRequest } from 'next/server';

/**
 * Build an absolute URL using the original client-facing host and protocol when
 * the app sits behind a reverse proxy (Traefik, nginx, Cloudflare). Falls back
 * to `request.url` when no forwarded headers are present.
 *
 * Next.js's `request.url` reflects the address the Node server bound to (often
 * `http://localhost:3000`), not the public URL the user requested. Using it
 * directly as the base for a redirect lands the user on the unreachable
 * loopback host.
 */
export function publicUrl(request: NextRequest, path: string): URL {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = forwardedHost || request.headers.get('host');
  const proto = forwardedProto || new URL(request.url).protocol.replace(':', '');

  if (host) {
    return new URL(path, `${proto}://${host}`);
  }
  return new URL(path, request.url);
}
