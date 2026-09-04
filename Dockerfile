FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html ./
COPY src ./src
ENV VITE_STORAGE_MODE=server
ENV VITE_API_URL=/
RUN pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/data ./src/data
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
