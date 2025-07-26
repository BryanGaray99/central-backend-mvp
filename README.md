# 🚀 Central Backend MVP - Generador de Proyectos de Testing

## Repositorio Frontend - Trabajo de titulación 

## Autor: Bryan Enrique Garay Benavidez

## 📋 Descripción del Proyecto

Este es el **motor de generación** de un sistema completo de testing automatizado. Su propósito es crear automáticamente proyectos de testing Playwright + BDD en TypeScript a partir de una configuración simple.

## 🏗️ Arquitectura del MVP

![Arquitectura del MVP](arquitectura.png)

### Componentes del diagrama

- **Public Frontend**
  - *Tecnologías*: Landing Page (React + TypeScript, AWS Amplify)
  - *Descripción*: Portal web que reúne documentación, descargas y recursos de soporte, facilitando el acceso y la adopción de la solución desde cualquier entorno.

- **Admin Dashboard**
  - *Tecnologías*: Dashboard privado (React + TypeScript, AWS Amplify, Cognito)
  - *Descripción*: Panel exclusivo para administración y monitoreo, con acceso restringido para el owner, permitiendo ajustes operativos y control centralizado del sistema.

- **Local User Environment**
  - *Tecnologías*: Dashboard local (React + TypeScript), Backend local (NestJS + TypeScript), Repositorio Git
  - *Descripción*: Entorno ejecutado en la máquina del usuario para gestionar pruebas, configuraciones y versionado, manteniendo privacidad y control total de los datos.

- **AI Service**
  - *Tecnologías*: OpenAI API (modelo fine-tuned)
  - *Descripción*: Servicio externo que genera y edita casos de prueba a partir de lenguaje natural, integrando capacidades avanzadas de automatización sin exponer datos sensibles.

- **Cloud Backend**
  - *Tecnologías*: API REST (AWS Lambda + NestJS + TypeScript), RDS (PostgreSQL), Secrets Manager, CloudWatch, S3
  - *Descripción*: Núcleo serverless que procesa solicitudes de IA, gestiona usuarios, almacena métricas y logs, protege credenciales y administra archivos grandes de manera segura y escalable.

### Herramientas, versiones y librerías principales

- **Frontend (React + TypeScript)**
  - Librerías: React 18+, TypeScript 4+, AWS Amplify para despliegue y hosting, integración con AWS Cognito para autenticación.
  - Herramientas de documentación y descarga integradas en la landing page.

- **Admin Dashboard**
  - React 18+, TypeScript, AWS Amplify, AWS Cognito para autenticación y control de acceso.

- **Backend Local (NestJS + TypeScript)**
  - NestJS 9+, TypeScript 4+, TypeORM para persistencia local (SQLite en MVP), middlewares de validación y logging.
  - Autenticación JWT (planificada para futuras fases), gestión de proyectos y endpoints vía API REST.

- **Repositorio Git**
  - Git local/remoto para versionado y control de cambios de los proyectos generados.

- **AI Service**
  - OpenAI API (modelos fine-tuned, integración vía REST), sin almacenamiento de datos sensibles en la nube.

- **Cloud Backend (Serverless)**
  - AWS Lambda (Node.js 18+), NestJS, PostgreSQL (AWS RDS), AWS Secrets Manager para gestión de credenciales, AWS CloudWatch para logs y métricas, AWS S3 para almacenamiento de archivos grandes.
  - Middlewares de seguridad, validación y logging.
  - Autenticación y autorización mediante API Keys y AWS Cognito.

---

## 📋 Requisitos

- **Node.js** (versión 18 o superior)
- **npm** (incluido con Node.js)

## 🎯 Propósito de este MVP

Este es el **motor de generación** del sistema completo. Se enfoca en crear proyectos de testing automáticamente desde una configuración simple. 

**¿Por qué instalación directa?**
- Este MVP está diseñado para ejecutarse **localmente** donde se generarán los proyectos
- Genera archivos, instala dependencias y ejecuta comandos npm/playwright
- En contenedores sería costoso y complejo manejar múltiples instalaciones de dependencias
- La parte que irá en la nube (con IA) será una fase posterior separada

## 🚀 Instalación y Ejecución

### Método 1: Instalación Directa con Node.js (⭐ RECOMENDADO)

Este es el método recomendado para este MVP del motor de generación.

#### 1. Clonar el Repositorio
```bash
git clone https://github.com/BryanGaray99/central-backend-mvp.git
cd central-backend-mvp
```

#### 2. Configurar Variables de Entorno
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar las variables según tu configuración
# Especialmente importante:
# - PORT: Puerto del servidor (default: 3000)
# - DATABASE_PATH: Ruta de la base de datos SQLite
# - PLAYWRIGHT_WORKSPACES_PATH: Ruta para los workspaces generados
```

#### 3. Instalar Dependencias
```bash
npm install
```

#### 4. Ejecutar el Servidor
```bash
npm run start:dev
```

#### 5. Verificar que Funciona
- **API**: http://localhost:3000
- **Documentación**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/v1/api/health

### ⚠️ Configuración del Archivo .env

Asegúrate de que tu archivo `.env` contenga las siguientes variables según el ejemplo `.env.example`:

```env
# Puerto del servidor
PORT=3000

# Ruta de la base de datos SQLite
DATABASE_PATH=central-backend.sqlite

# Ruta donde se crearán los workspaces de Playwright
PLAYWRIGHT_WORKSPACES_PATH=../playwright-workspaces

# Nivel de logging
LOG_LEVEL=debug

# Clave secreta JWT (para futuras integraciones)
JWT_SECRET=your-secret-key

# API Key (para futuras integraciones de seguridad)
API_KEY=your-api-key

# Configuración de generación
OVERRIDE_EXISTING=false

# Ruta al directorio de plantillas base
TEMPLATE_DIR=../e-commerce.playwright-testing-model
```

### Método 2: Con Docker (Solo para desarrollo/pruebas)

⚠️ **Nota**: Se configuró el Docker pero lo ideal sería instalarlo localmente ya que este MVP es para la parte de la solución que se instalaría localmente. 

```bash
docker-compose up --build
```

### 🎯 ¿Qué hace este MVP?

1. **Genera proyectos completos** de testing con Playwright + Cucumber
2. **Instala automáticamente** todas las dependencias necesarias
3. **Crea la estructura de carpetas** estándar para BDD
4. **Genera archivos de configuración** (playwright.config.ts, cucumber.cjs, etc.)
5. **Ejecuta health checks** para validar que todo funciona
6. **Gestiona endpoints** para analizar APIs y generar artefactos de testing

### 🏗️ Arquitectura del Sistema Completo

Este MVP es la **primera parte** de un sistema más grande:

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA COMPLETO                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Backend con IA - Fase Posterior                           │
│  ├── Ejecuta en la nube con Docker                          │
│  ├── Recibe peticiones en lenguaje natural                  │
│  ├── Traduce a JSON de generación                           │
│  └── Se comunica con este motor local                       │
│                                                             │
│  Motor de Generación (Este MVP)                             │
│  ├── Ejecuta localmente                                     │
│  ├── Genera proyectos de testing                            │
│  ├── Instala dependencias                                   │
│  └── Valida que todo funcione                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Status Actual del MVP

### ✅ **Completado**
- ✅ Backend NestJS con TypeORM y SQLite
- ✅ Sistema de detección automática de puertos (3000, 3001, 3002)
- ✅ Generación de proyectos Playwright + BDD
- ✅ Instalación automática de dependencias
- ✅ Health checks robustos
- ✅ Sistema de colas para generación asíncrona
- ✅ Limpieza automática en caso de fallos
- ✅ Gestión de workspaces aislados
- ✅ API REST completa con Swagger
- ✅ Validación de entrada y manejo de errores
- ✅ Módulo de endpoints para análisis de APIs

### 🔄 **En Desarrollo**
- 🔄 Generación de artefactos de testing (features, steps, fixtures)
- 🔄 Análisis automático de endpoints de APIs
- 🔄 Validación de proyectos generados

### 📋 **Próximos Pasos**
- 📋 Módulo de casos de prueba específicos
- 📋 Sistema de ejecución y reportes
- 📋 Integración con el backend de IA (fase posterior)


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

### Test Cases
- `POST /test-cases` - Crear caso de prueba
- `GET /test-cases` - Listar casos de prueba
- `GET /test-cases/:id` - Obtener caso de prueba
- `PUT /test-cases/:id` - Actualizar caso de prueba
- `DELETE /test-cases/:id` - Eliminar caso de prueba
- `POST /test-cases/:id/duplicate` - Duplicar caso de prueba
- `GET /test-cases/:id/export` - Exportar caso de prueba

### Test Steps
- `POST /test-cases/steps` - Crear plantilla de step
- `GET /test-cases/steps` - Listar plantillas de steps
- `GET /test-cases/steps/:id` - Obtener plantilla de step
- `PUT /test-cases/steps/:id` - Actualizar plantilla de step
- `DELETE /test-cases/steps/:id` - Eliminar plantilla de step

### Test Execution
- `POST /test-execution/execute` - Ejecutar tests
- `GET /test-execution/status` - Obtener estado de ejecución
- `GET /test-execution/results` - Obtener resultados
- `POST /test-execution/stop` - Detener ejecución
- `GET /test-execution/history` - Historial de ejecuciones

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
El sistema automáticamente prueba puertos 3000, 3001 y 3002. Si todos están ocupados, puedes especificar manualmente:
```bash
PORT=3003 npm run start:dev
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

### Configuración opcional con .env
Si quieres personalizar la configuración, puedes crear un archivo `.env`:
```bash
# Crear archivo .env (opcional)
cp .env.example .env

# Editar las variables según tus necesidades
nano .env  # o usar tu editor preferido
```

### Variables de entorno disponibles
Si creas un archivo `.env`, puedes configurar estas variables:
- `PORT`: Puerto del servidor (default: 3000)
- `PLAYWRIGHT_WORKSPACES_PATH`: Ruta para workspaces (default: ../playwright-workspaces)
- `LOG_LEVEL`: Nivel de logging (default: debug)
- `JWT_SECRET`: Clave secreta JWT (default: your-secret-key)
- `API_KEY`: API Key para seguridad (default: your-api-key)

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

## 📝 Notas Importantes

- **Ejecución Local**: Este MVP está diseñado para ejecutarse localmente donde se generarán los proyectos
- **Base de datos**: SQLite se crea automáticamente en la ruta `../playwright-workspaces/central-backend.sqlite`
- **Workspaces**: Se generan en la ruta `../playwright-workspaces` por defecto
- **Documentación**: Swagger UI disponible en `/docs`
- **Configuración**: El proyecto funciona sin archivo `.env` usando valores por defecto
- **Variables opcionales**: Puedes crear un archivo `.env` para personalizar la configuración

## 🔮 Arquitectura Futura

Este MVP es solo la primera parte del sistema completo:

1. **Motor de Generación** (este MVP) - Ejecuta localmente
2. **Backend con IA** (fase posterior) - Ejecuta en la nube con Docker
   - Gestiona peticiones de lenguaje natural
   - Traduce descripciones a JSON de generación
   - Se comunica con este motor local

---

**¡Listo! El servidor estará ejecutándose en http://localhost:3000**
