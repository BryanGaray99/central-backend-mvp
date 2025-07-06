# Central Backend MVP - API Endpoints Summary

## 🔗 Base URL
```
http://localhost:3000/v1/api
```

## 📚 Documentación Swagger
```
http://localhost:3000/docs
```

---

## 🏥 Health Check

### GET `/health`
Verifica el estado del servicio y sus dependencias.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 123.456,
    "version": "1.0.0",
    "environment": "development",
    "services": {
      "database": "connected",
      "fileSystem": "accessible"
    }
  },
  "message": "Service is healthy"
}
```

---

## 📁 Projects

### POST `/projects`
Crear un nuevo proyecto de testing.

**Request Body:**
```json
{
  "name": "Mi Proyecto Test",
  "description": "Proyecto de testing para API e-commerce"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Mi Proyecto Test",
  "description": "Proyecto de testing para API e-commerce",
  "status": "ready",
  "path": "./playwright-workspaces/mi-proyecto-test",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET `/projects`
Listar todos los proyectos.

### GET `/projects/:id`
Obtener un proyecto específico por ID.

### PATCH `/projects/:id`
Actualizar un proyecto.

**Request Body:**
```json
{
  "name": "Nuevo Nombre",
  "description": "Nueva descripción"
}
```

### DELETE `/projects/:id`
Eliminar un proyecto.

---

## 🔗 Endpoints

### POST `/projects/:projectId/endpoints`
Registrar y analizar un endpoint para generar artefactos de testing.

**Request Body:**
```json
{
  "entityName": "Product",
  "path": "/products",
  "methods": [
    {
      "method": "POST",
      "description": "Crear producto"
    },
    {
      "method": "GET",
      "description": "Obtener productos"
    }
  ],
  "section": "ecommerce"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "projectId": "uuid",
    "name": "Product API Endpoints",
    "endpointId": "uuid",
    "message": "Analysis and generation for endpoint 'Product' (POST, GET) started successfully."
  }
}
```

### GET `/projects/:projectId/endpoints`
Listar endpoints registrados de un proyecto.

### GET `/projects/:projectId/endpoints/:endpointId`
Obtener detalles de un endpoint específico.

### PATCH `/projects/:projectId/endpoints/:endpointId`
Actualizar metadata de un endpoint.

### DELETE `/projects/:projectId/endpoints/:endpointId`
Eliminar un endpoint.

---

## 🧪 Test Execution

### POST `/projects/:projectId/test-execution/execute`
Ejecutar casos de prueba para una entidad específica.

**Request Body:**
```json
{
  "entityName": "Product",
  "method": "POST",
  "testType": "positive",
  "tags": ["@smoke", "@create"],
  "specificScenario": "Create Product with valid data",
  "parallel": true,
  "timeout": 30000,
  "retries": 2,
  "browser": "chromium",
  "headless": true,
  "video": true,
  "screenshots": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "uuid",
    "status": "running",
    "message": "Test execution started successfully",
    "startedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET `/projects/:projectId/test-execution/results/:executionId`
Obtener resultados de una ejecución específica.

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "uuid",
    "status": "completed",
    "startedAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:05:00.000Z",
    "executionTime": 300000,
    "summary": {
      "totalScenarios": 10,
      "passedScenarios": 8,
      "failedScenarios": 2,
      "successRate": 0.8
    },
    "results": [
      {
        "scenarioName": "Create Product with valid data",
        "status": "passed",
        "duration": 1500,
        "steps": [...]
      }
    ]
  }
}
```

### GET `/projects/:projectId/test-execution/results`
Listar resultados de ejecuciones con filtros.

**Query Parameters:**
- `entityName` (optional): Filtrar por entidad
- `method` (optional): Filtrar por método HTTP
- `testType` (optional): Filtrar por tipo de prueba
- `status` (optional): Filtrar por estado
- `dateFrom` (optional): Fecha desde
- `dateTo` (optional): Fecha hasta
- `page` (optional): Número de página
- `limit` (optional): Límite por página

### DELETE `/projects/:projectId/test-execution/results/:executionId`
Eliminar resultados de una ejecución específica.

### GET `/projects/:projectId/test-execution/history/:entityName`
Obtener historial de ejecuciones por entidad.

### GET `/projects/:projectId/test-execution/summary`
Obtener resumen de ejecuciones del proyecto.

---

## 📊 Response Format

Todos los endpoints siguen un formato de respuesta consistente:

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {...}
  }
}
```

---

## 🔧 Status Codes

- `200` - OK
- `201` - Created
- `202` - Accepted (para operaciones asíncronas)
- `204` - No Content
- `400` - Bad Request
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `500` - Internal Server Error

---

## 🏷️ Tags de Swagger

- `health` - Estado del servicio
- `projects` - Gestión de proyectos de testing
- `endpoints` - Registro y gestión de endpoints de APIs
- `test-execution` - Ejecución y gestión de resultados de pruebas

---

## 📝 Ejemplos de Uso

### Flujo Completo de Testing

1. **Crear Proyecto**
   ```bash
   POST /v1/api/projects
   ```

2. **Registrar Endpoint**
   ```bash
   POST /v1/api/projects/{projectId}/endpoints
   ```

3. **Ejecutar Pruebas**
   ```bash
   POST /v1/api/projects/{projectId}/test-execution/execute
   ```

4. **Obtener Resultados**
   ```bash
   GET /v1/api/projects/{projectId}/test-execution/results/{executionId}
   ```

5. **Ver Historial**
   ```bash
   GET /v1/api/projects/{projectId}/test-execution/history/Product
   ```

---

## 🚀 Características Avanzadas

### Filtros de Ejecución
- Por entidad específica
- Por método HTTP
- Por tipo de prueba (positive/negative/all)
- Por tags de Cucumber
- Por escenario específico
- Por rango de fechas

### Configuración de Ejecución
- Ejecución paralela
- Timeout personalizable
- Reintentos automáticos
- Captura de video y screenshots
- Selección de navegador

### Metadata y Analytics
- Historial de ejecuciones
- Métricas de rendimiento
- Tendencias de fallos
- Estadísticas por escenario y step
- Dashboard de resultados

---

## 📚 Documentación Adicional

- **Swagger UI**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/v1/api/health`
- **Base Path**: `/v1/api`

---

## 🔒 Seguridad

- Validación de entrada con class-validator
- Sanitización de datos
- Manejo de errores centralizado
- Logs detallados para debugging
- Rate limiting (configurable)

---

## 🛠️ Tecnologías

- **Backend**: NestJS + TypeScript
- **Base de Datos**: SQLite
- **Testing**: Playwright + Cucumber
- **Documentación**: Swagger/OpenAPI
- **Validación**: class-validator + class-transformer
- **Logging**: Winston + NestJS Logger 