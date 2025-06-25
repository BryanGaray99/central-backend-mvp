# Multi-stage build para optimizar el tamaño de la imagen
FROM node:20 AS builder

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para el build)
RUN npm ci

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Stage de producción
FROM node:20 AS production

# Crear usuario no-root para seguridad
RUN addgroup --gid 1001 nodejs && useradd -m -u 1001 -g nodejs nestjs

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copiar archivos construidos desde el stage anterior
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Asegura permisos de escritura para nestjs en /app, /app/data y /playwright-workspaces
RUN mkdir -p /playwright-workspaces /app/data && chown -R nestjs:nodejs /app /playwright-workspaces

# Cambiar al usuario no-root
USER nestjs

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
# ENV DATABASE_PATH=/app/data/central-backend.sqlite

# Comando para ejecutar la aplicación
CMD ["node", "dist/main"] 