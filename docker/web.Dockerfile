# syntax=docker/dockerfile:1.7
# The Next.js web tier as a Lambda container image (Function URL, response streaming), ADR 0018.
# Build context is the frontend directory:
#   docker build -f docker/web.Dockerfile \
#     --build-arg UPLOAD_BUCKET_HOST=<bucket>.s3.<region>.amazonaws.com -t unfold-web frontend
#
# `UPLOAD_BUCKET_HOST` is read by `next build` (it pins the CSP connect-src to the presigned-upload host), so it is a
# build argument. Everything else (API_INTERNAL_URL, SSM_PATH_PREFIX) is a runtime setting of the function.
# The signing secret is read from SSM when the server starts (src/instrumentation.ts), never baked in.

ARG NODE_IMAGE=node:24-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54
ARG LWA_IMAGE=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0@sha256:17cfd08eff1dfea3f6a9a1e9c65fdac80aa4919b6085e746615530f43f57d2f1

FROM ${LWA_IMAGE} AS lwa

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG UPLOAD_BUCKET_HOST=""
ENV UPLOAD_BUCKET_HOST=${UPLOAD_BUCKET_HOST} NEXT_TELEMETRY_DISABLED=1
# git does not track the empty public directory
RUN mkdir -p public && npm run build

FROM ${NODE_IMAGE} AS web-lambda
WORKDIR /app
# TRUST_LAMBDA_SOURCE_IP: the rate-limit identity is the peer AWS saw (see src/lib/client-address.ts).
# Lambda runs the image read-only apart from /tmp.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 HOME=/tmp \
    TRUST_LAMBDA_SOURCE_IP=1 \
    AWS_LWA_PORT=3000 AWS_LWA_READINESS_CHECK_PATH=/ AWS_LWA_INVOKE_MODE=response_stream
COPY --from=lwa /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
