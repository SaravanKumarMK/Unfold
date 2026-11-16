# Deploy log

## 2026-10-13: dev environment live (account 822491881190, us-east-1)

* Bootstrap applied (state bucket `unfold-tfstate-822491881190`, lock table, plan/apply/images roles; the account's existing GitHub OIDC provider is reused).
* `envs/dev` applied: 72 resources, images `7d3d0bb` (api, worker, exporter) from ECR.
* New-account limits met on the first apply: Lambda memory capped at 3008 MB, concurrency quota 10 (reserved concurrency off: `api_memory_mb=3008`, `api_reserved_concurrency=-1`).
* Frontend: Vercel project `unfold-roan`, env `API_INTERNAL_URL`, `PROXY_HMAC_SECRET`, `UPLOAD_BUCKET_HOST`, `PUBLIC_WEB_ORIGIN`. The first secret (base64) did not verify in Vercel; a hex secret replaced it.
* Smoke through `https://unfold-roan.vercel.app`: session 201; GitHub project `psf/requests` (1 070 chunks) analysed on Fargate in 7 min 36 s, status `succeeded`, guide ready (15 min read); chat answer with evidence citations in 69 s (cold start included); no ECS task running afterwards (idle check).
* Unsigned direct calls to the Function URL return 403 (signed-only in production).

Not yet run: failure drill (kill a task, DLQ), cleanup/expiry check, Cost Explorer after 24-48 h, ZIP upload through the browser, PDF export, prod environment.

## 2026-11-15: web tier moved to AWS (account 822491881190, us-east-1)

* Correction (2026-11-16): the live Vercel app is `unfold-the-project.vercel.app` and works; the `unfold-roan` URL tested here was the wrong one. `web_origin` was restored to the Vercel origin on dev (S3 CORS, API `PUBLIC_WEB_ORIGIN`). Original note: `unfold-roan.vercel.app` returned `DEPLOYMENT_NOT_FOUND`; the API Lambda still answered `/health` 200 after 34 idle days and no task or service was running.
* Registry applied first (web repository, lifecycle keeps 2 tagged images), then `envs/dev` with the web Lambda (`unfold-dev-web`, ADR 0018): 8 added, 0 destroyed. Dev apply is driven by an untracked `local.auto.tfvars` (values read back from the live state).
* A 502 on the proxied session call (reserved `x-amzn-*` headers from the API's Function URL) was found by the first smoke call and fixed in `route.ts` (image `7e82624`).
* Second apply: `web_origin` = the web Lambda URL (S3 CORS, `PUBLIC_WEB_ORIGIN`). Web image `3e3fa68` (CSP upload host = the global S3 host the API presigns in us-east-1; found while testing the presigned flow). API, worker, exporter images unchanged (`7d3d0bb`; no backend change).
* Live checks through `https://xs6xtk7n4sjl4k2utstd2z4yvu0mnppv.lambda-url.us-east-1.on.aws` (all executed, not inferred):
  * home 200 (cold 4.1 s, warm 1.2 s); session 201 with cookie; unsigned call straight to the API Function URL 403.
  * `psf/requests`: analysed on Fargate, then **failed** at guide generation: Gemini keys 1-3 answer 402 "prepayment credits are depleted", key 4 401; Groq rate-limits. Job failed cleanly, task exited, no task left running.
  * Failure drill on `octocat/Hello-World`: task stopped by hand (exit 137), `task_stopped` classified it `crashed`, a new task started about 3 min later and the job finished `succeeded`.
  * On that project: guide (3 chapters) 200, architecture 200, plain chat 200 (44 s cold, grounded 1/1 claims), streamed chat (NDJSON deltas about 110 ms apart through web and API Lambdas), PDF export ready in about 55 s and a valid 92 KB `%PDF-1.4` through the 302 to a presigned S3 URL, exporter task gone afterwards.
  * ZIP: ticket 201, CORS preflight from the web origin 200, S3 POST 204, complete 202; the job then spent its time in provider rate limits (not finished when the test projects were deleted). Delete: both projects 404 at once, background cleanup 202.
  * Idle: 0 ECS tasks after every run; alarms OK; no errors in the web or API log groups for the window.
* Not run: `deploy.yml` (bootstrap OIDC trust not re-applied for `SaravanKumarMK/Unfold`: `terraform apply` in `bootstrap` with `-var github_owner=SaravanKumarMK -var github_repo=Unfold`, then set the repository variables and GitHub Environments), `psf/requests` guide, prod environment, browser (real DOM) ZIP upload, 24 h idle Cost Explorer for the web image.
