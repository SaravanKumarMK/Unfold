import { isIP } from "node:net";

/**
 * The one address the API may rate-limit on. Only syntactically valid IPs are returned, so a header can never mint
 * arbitrary keys. Trusted sources, first match wins:
 *
 * - Vercel (`VERCEL` set): the platform header, which Vercel strips from client requests.
 * - AWS Lambda Function URL behind the Lambda Web Adapter (`TRUST_LAMBDA_SOURCE_IP=1`): the adapter rebuilds
 *   `x-amzn-request-context` from the invocation event on every request (a client-sent copy is overwritten), and
 *   `http.sourceIp` is the peer AWS saw. `X-Forwarded-For` is NOT used there: a Function URL passes a client-supplied
 *   value through unchanged (measured 2026-11-15), so it is forgeable.
 * - Elsewhere the header is ignored unless `TRUST_FORWARDED_FOR=1`, which is only valid behind a reverse proxy
 *   (Caddy, nginx) that *appends* the peer; the last entry is then the trusted one.
 *
 * By default this returns null and the API rate-limits on the Next server's own peer address, which is safe
 * (coarser, never spoofable). The API honours the result only from `TRUSTED_PROXY_IPS`.
 */
export function clientAddress(request: Request): string | null {
  if (process.env.VERCEL) {
    const platform = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");
    const first = platform?.split(",")[0]?.trim();
    if (first && isIP(first)) return first;
  }
  if (process.env.TRUST_LAMBDA_SOURCE_IP === "1") return lambdaSourceIp(request);
  if (process.env.TRUST_FORWARDED_FOR !== "1") return null;
  const last = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return last && isIP(last) ? last : null;
}

function lambdaSourceIp(request: Request): string | null {
  try {
    const context = JSON.parse(request.headers.get("x-amzn-request-context") ?? "null");
    const ip = context?.http?.sourceIp;
    return typeof ip === "string" && isIP(ip) ? ip : null;
  } catch {
    return null;
  }
}
