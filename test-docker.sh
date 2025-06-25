#!/bin/bash

echo "🧪 Testing Central Backend in Docker"
echo "====================================="

# Wait for container to be ready
echo "⏳ Waiting for container to be ready..."
sleep 10

# Test health endpoint
echo "🏥 Testing health endpoint..."
curl -s http://localhost:3000/health | jq .

# Test queue status
echo "📊 Testing queue status..."
curl -s http://localhost:3000/projects/queue/status | jq .

# Create a test project
echo "🚀 Creating test project..."
PROJECT_RESPONSE=$(curl -s -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "docker-test-project",
    "displayName": "Docker Test Project",
    "baseUrl": "http://localhost:3004",
    "metadata": {
      "author": "Docker Test",
      "description": "Test project for Docker debugging"
    }
  }')

echo "📋 Project creation response:"
echo "$PROJECT_RESPONSE" | jq .

# Extract project ID
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.data.id')
echo "🆔 Project ID: $PROJECT_ID"

# Check queue status again
echo "📊 Queue status after project creation:"
curl -s http://localhost:3000/projects/queue/status | jq .

# Wait and check project status
echo "⏳ Waiting 30 seconds for generation..."
sleep 30

echo "📋 Project status:"
curl -s http://localhost:3000/projects/$PROJECT_ID | jq .

echo "📊 Final queue status:"
curl -s http://localhost:3000/projects/queue/status | jq .

echo "✅ Test completed!" 