# Multi-stage build para optimizar el tamaño de la imagen
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage de producción
FROM node:20 AS production

# Crear usuario no-root
RUN addgroup --gid 1001 nodejs && \
    useradd -m -u 1001 -g nodejs nestjs

WORKDIR /app

# Copiar sólo package.json y package-lock.json
COPY package*.json ./

# 1) Instalar deps de producción
# 2) Luego añadir explícitamente sólo los paquetes de dev que necesitas para PlaywrightService
RUN npm ci --only=production && \
    npm install --no-audit --no-fund \
      @playwright/test ts-node typescript @types/node \
      @cucumber/cucumber @cucumber/pretty-formatter \
      @faker-js/faker ajv ajv-formats dotenv && \
    npm cache clean --force

# Copiar el build de Nest
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Crear carpetas de trabajo para PlaywrightService
RUN mkdir -p /playwright-workspaces /app/data && \
    chown -R nestjs:nodejs /app /playwright-workspaces

USER nestjs

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/main"]
