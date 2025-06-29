# Endpoints API - curl Commands

## 1. POST /projects/{projectId}/endpoints - Register and analyze endpoint

```bash
curl -X POST http://localhost:3000/projects/0b6391fa-af99-4d81-a7b4-b21b737b9985/endpoints \
-H "Content-Type: application/json" \
-d '{
  "section": "ecommerce",
  "entityName": "Product",
  "path": "/v1/api/products",
  "description": "Complete CRUD for products with all HTTP methods",
  "methods": [
    {
      "method": "GET",
      "description": "Get all products or filter by category"
    },
    {
      "method": "POST",
      "description": "Create a new product",
      "requestBodyDefinition": [
        {
          "name": "name",
          "type": "string",
          "example": "iPhone 15 Pro",
          "validations": {
            "minLength": 2,
            "required": true
          }
        },
        {
          "name": "description",
          "type": "string",
          "example": "Latest Apple iPhone with advanced features",
          "validations": {
            "required": true
          }
        },
        {
          "name": "price",
          "type": "number",
          "example": 999.99,
          "validations": {
            "minimum": 0,
            "required": true
          }
        },
        {
          "name": "categoryId",
          "type": "string",
          "example": "cat-1",
          "validations": {
            "required": true
          }
        },
        {
          "name": "stock",
          "type": "number",
          "example": 50,
          "validations": {
            "minimum": 0,
            "required": true
          }
        },
        {
          "name": "imageUrl",
          "type": "string",
          "example": "https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg"
        },
        {
          "name": "isActive",
          "type": "boolean",
          "example": true,
          "validations": {
            "default": true
          }
        }
      ]
    },
    {
      "method": "PATCH",
      "description": "Update an existing product",
      "requestBodyDefinition": [
        {
          "name": "name",
          "type": "string",
          "example": "iPhone 15 Pro Max",
          "validations": {
            "minLength": 2
          }
        },
        {
          "name": "description",
          "type": "string",
          "example": "Updated description for iPhone 15 Pro Max"
        },
        {
          "name": "price",
          "type": "number",
          "example": 1099.99,
          "validations": {
            "minimum": 0
          }
        },
        {
          "name": "categoryId",
          "type": "string",
          "example": "cat-1"
        },
        {
          "name": "stock",
          "type": "number",
          "example": 75,
          "validations": {
            "minimum": 0
          }
        },
        {
          "name": "imageUrl",
          "type": "string",
          "example": "https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg"
        },
        {
          "name": "isActive",
          "type": "boolean",
          "example": true
        }
      ]
    },
    {
      "method": "DELETE",
      "description": "Delete a product"
    }
  ],
  "pathParameters": [
    {
      "name": "id",
      "value": "prod-1"
    }
  ]
}'
```

## 2. GET /projects/{projectId}/endpoints - List endpoints

```bash
curl -X GET "http://localhost:3000/projects/0b6391fa-af99-4d81-a7b4-b21b737b9985/endpoints" \
-H "Content-Type: application/json"
```

## 3. GET /projects/{projectId}/endpoints/{endpointId} - Get specific endpoint

```bash
curl -X GET "http://localhost:3000/projects/0b6391fa-af99-4d81-a7b4-b21b737b9985/endpoints/a1b2c3d4-e5f6-7890-1234-567890abcdef" \
-H "Content-Type: application/json"
```

## 4. PATCH /projects/{projectId}/endpoints/{endpointId} - Update endpoint

```bash
curl -X PATCH "http://localhost:3000/projects/0b6391fa-af99-4d81-a7b4-b21b737b9985/endpoints/a1b2c3d4-e5f6-7890-1234-567890abcdef" \
-H "Content-Type: application/json" \
-d '{
  "entityName": "Product",
  "section": "ecommerce",
  "description": "Updated CRUD for products with improved validations"
}'
```

## 5. DELETE /projects/{projectId}/endpoints/{endpointId} - Delete endpoint

```bash
curl -X DELETE "http://localhost:3000/projects/0b6391fa-af99-4d81-a7b4-b21b737b9985/endpoints/a1b2c3d4-e5f6-7890-1234-567890abcdef" \
-H "Content-Type: application/json"
```

## Notes

- Replace `0b6391fa-af99-4d81-a7b4-b21b737b9985` with your actual project ID
- Replace `a1b2c3d4-e5f6-7890-1234-567890abcdef` with the actual endpoint UUID
- The `projectId` is automatically injected from the URL
- All responses follow the structure: `{ success: boolean, data: any, message?: string }` 