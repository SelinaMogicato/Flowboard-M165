# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only what we need at runtime
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Render expects your service to bind to 0.0.0.0 and a port (default 10000).
ENV HOST=0.0.0.0
ENV PORT=10000

EXPOSE 10000

CMD ["node", "./dist/server/entry.mjs"]
