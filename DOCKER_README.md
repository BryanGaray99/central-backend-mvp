# 🐳 Docker - Central Backend MVP

## 📋 Requisitos Previos

- Docker Desktop instalado y ejecutándose
- Docker Compose (incluido en Docker Desktop)

## 🚀 Inicio Rápido

### 1. Construir la imagen
```bash
docker-compose build
```

### 2. Iniciar la aplicación
```bash
docker-compose up -d
```

### 3. Verificar que esté funcionando
```bash
# Verificar estado
docker-compose ps

# Ver logs
docker-compose logs -f

# Probar health check
curl http://localhost:3000/health
```

## 🌐 Acceso a la API

Una vez que el contenedor esté ejecutándose:

- **API Base**: http://localhost:3000
- **Swagger UI**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

## 📁 Estructura de Volúmenes

El `docker-compose.yml` mapea los siguientes directorios:

```
./data/                    → /app/data/                    (Base de datos SQLite)
./playwright-workspaces/   → /app/playwright-workspaces/   (Proyectos generados)
```

## 🔧 Comandos Útiles

### Gestión básica
```bash
# Iniciar en modo detached
docker-compose up -d

# Detener
docker-compose down

# Reiniciar
docker-compose restart

# Ver logs
docker-compose logs -f central-backend
```

### Desarrollo
```bash
# Iniciar en modo desarrollo (con hot reload)
docker-compose --profile dev up -d

# Acceder al shell del contenedor
docker-compose exec central-backend sh

# Ejecutar comandos dentro del contenedor
docker-compose exec central-backend npm run test
```

### Limpieza
```bash
# Detener y eliminar contenedores
docker-compose down

# Eliminar también imágenes
docker-compose down --rmi all

# Limpieza completa (contenedores, imágenes, volúmenes)
docker-compose down --rmi all --volumes --remove-orphans
```

## 🛠️ Scripts de Conveniencia (Linux/Mac)

Si estás en Linux o Mac, puedes usar el script incluido:

```bash
# Hacer ejecutable (solo la primera vez)
chmod +x docker-scripts.sh

# Usar el script
./docker-scripts.sh build
./docker-scripts.sh start
./docker-scripts.sh logs
./docker-scripts.sh stop
```

## 🔍 Troubleshooting

### Puerto ya en uso
Si el puerto 3000 está ocupado, modifica el `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Cambiar 3000 por 3001
```

### Problemas de permisos (Linux/Mac)
```bash
# Crear directorios con permisos correctos
mkdir -p data playwright-workspaces
chmod 755 data playwright-workspaces
```

### Verificar logs de errores
```bash
# Ver logs del contenedor
docker-compose logs central-backend

# Ver logs en tiempo real
docker-compose logs -f central-backend

# Ver logs de los últimos 100 líneas
docker-compose logs --tail=100 central-backend
```

### Reiniciar desde cero
```bash
# Parar y eliminar todo
docker-compose down --volumes --remove-orphans

# Eliminar imagen
docker rmi central-backend-mvp_central-backend

# Reconstruir
docker-compose build --no-cache
docker-compose up -d
```

## 🔒 Variables de Entorno

Puedes personalizar la configuración modificando las variables en `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - DATABASE_PATH=/app/data/central-backend.sqlite
```

## 📊 Monitoreo

### Health Check
El contenedor incluye un health check que verifica:
- Disponibilidad del endpoint `/health`
- Tiempo de respuesta < 10s

### Métricas
```bash
# Ver uso de recursos
docker stats central-backend-mvp

# Ver información del contenedor
docker inspect central-backend-mvp
```

## 🚀 Despliegue en Producción

### 1. Construir imagen optimizada
```bash
docker build -t central-backend-mvp:latest .
```

### 2. Ejecutar en producción
```bash
docker run -d \
  --name central-backend-mvp \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/playwright-workspaces:/app/playwright-workspaces \
  --restart unless-stopped \
  central-backend-mvp:latest
```

### 3. Con Docker Compose
```bash
# Usar archivo de producción
docker-compose -f docker-compose.prod.yml up -d
```

## 🔄 Actualizaciones

Para actualizar la aplicación:

```bash
# 1. Detener
docker-compose down

# 2. Reconstruir
docker-compose build --no-cache

# 3. Reiniciar
docker-compose up -d
```

## 📝 Notas Importantes

1. **Persistencia**: Los datos se mantienen en los volúmenes mapeados
2. **Seguridad**: El contenedor se ejecuta como usuario no-root
3. **Rendimiento**: Usa multi-stage build para optimizar el tamaño
4. **Logs**: Los logs se pueden ver con `docker-compose logs`

## 🆘 Soporte

Si encuentras problemas:

1. Verifica que Docker Desktop esté ejecutándose
2. Revisa los logs con `docker-compose logs`
3. Asegúrate de que los puertos no estén ocupados
4. Verifica que los directorios tengan permisos correctos 