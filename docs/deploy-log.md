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

* `unfold-roan.vercel.app` returned `DEPLOYMENT_NOT_FOUND` and no Vercel login exists on the operator machine; the API Lambda still answered `/health` 200 after 34 idle days and no task or service was running.
* Registry applied first (web repository, lifecycle keeps 2 tagged images), then `envs/dev` with the web Lambda (`unfold-dev-web`, ADR 0018): 8 added, 0 destroyed. Dev apply is driven by an untracked `local.auto.tfvars` (values read back from the live state).
* A 502 on the proxied session call (reserved `x-amzn-*` headers from the API's Function URL) was found by the first smoke call and fixed in `route.ts` (image `7e82624`).
