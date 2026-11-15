# 0018. The web tier runs on AWS Lambda, not Vercel

Status: accepted (2026-11-15)

## Context

ADR 0010 to 0016 put the API, workers and data on scale-to-zero AWS services and left the Next.js site on Vercel.
On 2026-11-15 `unfold-roan.vercel.app` answered `DEPLOYMENT_NOT_FOUND` and no Vercel credential was available to
redeploy it, so the product had no reachable front end while the AWS side (checked the same day: health 200 after
34 idle days) was healthy. A second hosting vendor with its own login, secrets copy and quota was also the one part
of the stack outside Terraform, the policy tests and the cost model.

## Decision

Run the same Next.js server (`output: "standalone"`) as a container-image Lambda with a Function URL and response
streaming behind the Lambda Web Adapter, exactly like the API (`docker/web.Dockerfile`, target `web-lambda`;
Terraform reuses `modules/api` as `module.web`). Consequences handled in code:

* **Client identity.** A Function URL passes a client-supplied `X-Forwarded-For` through unchanged (measured with a
  throwaway echo function), so it is forgeable. With `TRUST_LAMBDA_SOURCE_IP=1` the proxy takes
  `http.sourceIp` from `x-amzn-request-context`, which the adapter rebuilds from the invocation event on every request
  (`HeaderMap::insert`, awslabs/aws-lambda-web-adapter `src/lib.rs`), and signs that address as before (ADR 0016).
* **Secret.** `PROXY_HMAC_SECRET` is read from SSM at server start (`src/instrumentation.ts`) by a role that may read
  only that parameter. It is not in Terraform state or in the function's environment.
* **Headers.** The proxy drops `x-amzn-*` and `date` in both directions: the API's own Function URL adds
  `x-amzn-remapped-*`, and returning them from a streaming Function URL yields a 502 status with a good body.
* **Origin cycle.** The API needs the web origin (S3 CORS, `PUBLIC_WEB_ORIGIN`) and the web needs the API URL, so
  `var.web_origin` is applied twice: placeholder first, then `web_url`.

## Alternatives

* Another static/edge host (Cloudflare, Netlify, Amplify): a new vendor and credential for the same Node server.
* S3 + CloudFront with a static export: the cookie proxy, signing and streaming need a server; CloudFront adds a
  distribution to price and police.
* Re-create the Vercel project: needs a login this environment does not have, and keeps the split.

## Costs and limits

No idle charge: a Lambda bills per request and the image sits in ECR (about 0.17 GB compressed). A proxied chat
holds two concurrent executions (web and API); the new account's concurrency quota is 10 and reserved concurrency is
off, so about 5 simultaneous chats. Cold start of the web function is about 3 s, then about 1 s warm for a page.
