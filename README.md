# 🚀 Central Backend MVP - Generador de Proyectos de Testing

Sistema backend para generar automáticamente proyectos de testing Playwright + BDD en TypeScript.

## 📋 Requisitos

- **Node.js** (versión 18 o superior)
- **npm** (incluido con Node.js)

## 🚀 Instalación y Ejecución

### Método 1: Instalación Directa (Recomendado)

#### 1. Instalar Dependencias
```bash
npm install
```

#### 2. Ejecutar el Servidor
```bash
npm run start:dev
```

#### 3. Verificar que Funciona
- **API**: http://localhost:3000
- **Documentación**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

### Método 2: Con Docker (Alternativa)

Si tienes Docker instalado, puedes usar esta opción:

#### 1. Construir y Ejecutar con Docker Compose
```bash
docker-compose up --build
```

#### 2. O ejecutar solo el contenedor
```bash
docker build -t central-backend .
docker run -p 3000:3000 central-backend
```

#### 3. Verificar que Funciona
- **API**: http://localhost:3000
- **Documentación**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

## 📚 Endpoints Disponibles

### Proyectos
- `POST /projects` - Crear proyecto
- `GET /projects` - Listar proyectos
- `GET /projects/:id` - Obtener proyecto
- `PUT /projects/:id` - Actualizar proyecto
- `DELETE /projects/:id` - Eliminar proyecto

### Endpoints
- `POST /endpoints/register` - Registrar y analizar endpoint
- `GET /endpoints/:projectId` - Listar endpoints de un proyecto
- `PUT /endpoints/:id` - Actualizar endpoint
- `DELETE /endpoints/:id` - Eliminar endpoint

## 🧪 Probar la API

### Crear un Proyecto
```bash
curl -X POST http://localhost:3000/projects \
-H "Content-Type: application/json" \
-d '{
  "name": "mi-proyecto-test",
  "displayName": "Mi Proyecto de Testing",
  "baseUrl": "http://localhost:3004",
  "metadata": {
    "author": "Tu Nombre",
    "description": "Proyecto de prueba"
  }
}'
```

### Listar Proyectos
```bash
curl http://localhost:3000/projects
```

### Verificar Health
```bash
curl http://localhost:3000/health
```

## 🛠️ Scripts Disponibles

```bash
npm run start:dev    # Desarrollo (hot reload)
npm run build        # Construir para producción
npm run start:prod   # Ejecutar en producción
npm run test         # Ejecutar tests
```

## 🛠️ Solución de Problemas

### Puerto ocupado
```bash
PORT=3001 npm run start:dev
```

### Problemas de dependencias
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Base de datos corrupta
```bash
rm central-backend.sqlite
npm run start:dev
```

### Problemas con Docker
```bash
# Limpiar contenedores
docker-compose down
docker system prune -f

# Reconstruir
docker-compose up --build
```

## 📁 Estructura

```
src/
├── modules/
│   ├── projects/     # Gestión de proyectos
│   ├── endpoints/    # Gestión de endpoints
│   └── workspace/    # Gestión de workspaces
├── common/           # Utilidades comunes
└── main.ts          # Punto de entrada
```

## 📝 Notas

- La base de datos SQLite se crea automáticamente
- Los workspaces se generan en `playwright-workspaces/`
- Documentación interactiva disponible en Swagger UI
- No requiere configuración adicional
- **Método Docker**: Garantiza funcionamiento en cualquier entorno
- **Método Directo**: Más rápido para desarrollo local

## Uso de base de datos en local y Docker

- **En local (Windows/desarrollo):**
  - Usa `.env` con:
    ```env
    DATABASE_PATH=central-backend.sqlite
    PLAYWRIGHT_WORKSPACES_PATH=../playwright-workspaces
    ```
  - El archivo `central-backend.sqlite` se crea y usa solo en tu máquina.

- **En Docker:**
  - La base de datos se crea automáticamente dentro del contenedor en `/app/data/central-backend.sqlite` y **se persiste en `./data/central-backend.sqlite` del host**.
  - Se mapea como volumen para mantener los datos entre reinicios del contenedor:
    ```yaml
    volumes:
      - ./data:/app/data
      - ../playwright-workspaces:/playwright-workspaces
    ```
  - Si quieres una base de datos nueva cada vez, elimina el volumen `./data:/app/data` del docker-compose.yml.

- **Comando para construir y levantar el contenedor:**

```sh
docker-compose up --build
```

---

**¡Listo! El servidor estará ejecutándose en http://localhost:3000**

**💡 Recomendación**: Usa el método directo para desarrollo y Docker para demostraciones o distribución.
