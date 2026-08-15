# syntax=docker/dockerfile:1
# Build the ASHA Sathi web dashboard and serve it with nginx.

# ---- Stage 1: install dependencies ----
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /repo

# Monorepo manifests first for better layer caching.
COPY pnpm-workspace.yaml turbo.json package.json ./
COPY apps/web-dashboard/package.json apps/web-dashboard/
COPY packages/design-system/react/package.json packages/design-system/react/

RUN pnpm install --frozen-lockfile

# ---- Stage 2: build ----
FROM deps AS build
WORKDIR /repo
COPY apps/web-dashboard apps/web-dashboard
COPY packages/design-system/react packages/design-system/react

RUN pnpm --filter web-dashboard build

# ---- Stage 3: serve ----
FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web-dashboard/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
