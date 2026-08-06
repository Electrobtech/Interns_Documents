# AI Agents Port Configuration - Setup Guide

## Overview
This document outlines the changes made to configure AI agents on separate ports (4020-4023) instead of a single service.

## New Port Configuration

### AI Agent Services
- **AI Overview Service**: Port 4020 (Status, analytics, orchestration, knowledge base)
- **AI Marketing Service**: Port 4021 (Marketing agent endpoints)
- **AI Sales Service**: Port 4022 (Sales agent endpoints)
- **AI Support Service**: Port 4023 (Support agent endpoints)

## Changes Made

### 1. Created Separate Entrypoint Scripts
- `ai-agent-backend/entrypoint-overview.sh` - Starts service on port 4020
- `ai-agent-backend/entrypoint-marketing.sh` - Starts service on port 4021
- `ai-agent-backend/entrypoint-sales.sh` - Starts service on port 4022
- `ai-agent-backend/entrypoint-support.sh` - Starts service on port 4023

### 2. Updated Dockerfile
- Added all entrypoint scripts to the Dockerfile
- Exposed ports 4020, 4021, 4022, 4023

### 3. Updated docker-compose.yml
- Replaced single `ai-agent-service` with 4 separate services:
  - `ai-overview-service` (port 4020)
  - `ai-marketing-service` (port 4021)
  - `ai-sales-service` (port 4022)
  - `ai-support-service` (port 4023)
- Updated API gateway environment variables
- Updated service dependencies

### 4. Updated API Gateway (api-gateway/src/index.js)
- Added separate service URLs for each AI agent
- Updated routing to direct requests to appropriate services:
  - `/ai-agents/status` → AI Overview Service (4020)
  - `/ai-agents/analytics` → AI Overview Service (4020)
  - `/ai-agents/marketing` → AI Marketing Service (4021)
  - `/ai-agents/sales` → AI Sales Service (4022)
  - `/ai-agents/support` → AI Support Service (4023)
  - `/agents/marketing` → AI Marketing Service (4021)
  - `/agents/sales` → AI Sales Service (4022)
  - `/agents/support` → AI Support Service (4023)

### 5. Required .env File Changes
**IMPORTANT: You must manually update your .env file with these changes:**

#### Replace the AI Service section with:
```env
# ─────────────────────────────────────────────────────────────────────────────
# AI Agent Services  (FastAPI / Python — Overview, Marketing, Sales, Support agents)
# ─────────────────────────────────────────────────────────────────────────────

# Primary LLM provider: "groq" | "ollama"
LLM_PROVIDER=groq
# Fallback if primary fails
LLM_FALLBACK_PROVIDER=ollama

# Groq — fast Llama 3.3 inference
GROQ_API_KEY=your_groq_api_key_here
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.3-70b-versatile

# Ollama — local fallback generation + ALL embeddings
# Inside compose the host is always http://ollama:11434
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=qwen3:8b

# Embedding model served by Ollama (768-dim — matches pgvector Vector(768))
# Run: docker exec ollama ollama pull nomic-embed-text
EMBEDDING_MODEL=nomic-embed-text

# AI Agent Service Ports
AI_OVERVIEW_PORT=4020
AI_MARKETING_PORT=4021
AI_SALES_PORT=4022
AI_SUPPORT_PORT=4023
```

#### Replace the Inter-service URLs section:
```env
# OLD: AI_SERVICE_URL=http://ai-agent-service:4005
# NEW:
AI_OVERVIEW_SERVICE_URL=http://ai-overview-service:4020
AI_MARKETING_SERVICE_URL=http://ai-marketing-service:4021
AI_SALES_SERVICE_URL=http://ai-sales-service:4022
AI_SUPPORT_SERVICE_URL=http://ai-support-service:4023
```

## Service Endpoints

### AI Overview Service (Port 4020)
- `GET /ai-agents/status` - Overall agent status
- `GET /ai-agents/analytics` - Analytics data
- `GET /ai-agents/health` - Health check
- `GET /ai-agents/knowledge` - Knowledge base management
- `GET /ai-agents/sessions` - Session management
- `GET /ai-agents/runs` - Execution history
- `POST /ai-agents/orchestrate` - Agent orchestration

### AI Marketing Service (Port 4021)
- `POST /ai-agents/marketing/run` - Run marketing agent
- `GET /ai-agents/marketing/runs` - Marketing agent history
- `POST /agents/marketing` - Frontend marketing endpoint

### AI Sales Service (Port 4022)
- `POST /ai-agents/sales/run` - Run sales agent
- `GET /ai-agents/sales/runs` - Sales agent history
- `POST /ai-agents/sales/fit-score` - Lead fit scoring
- `POST /agents/sales` - Frontend sales endpoint

### AI Support Service (Port 4023)
- `POST /ai-agents/support/run` - Run support agent
- `GET /ai-agents/support/runs` - Support agent history
- `POST /agents/support` - Frontend support endpoint

## Testing the Configuration

### 1. Update .env file
Make the manual changes outlined above to your .env file.

### 2. Rebuild and start services
```bash
docker-compose down
docker-compose up -d ai-overview-service ai-marketing-service ai-sales-service ai-support-service api-gateway
```

### 3. Check service health
```bash
# Test Overview Service
curl http://localhost:4020/ai-agents/health

# Test Marketing Service
curl http://localhost:4021/ai-agents/health

# Test Sales Service
curl http://localhost:4022/ai-agents/health

# Test Support Service
curl http://localhost:4023/ai-agents/health
```

### 4. Test through API Gateway
```bash
# Test Overview through gateway
curl http://localhost:8080/ai-agents/health

# Test specific agents (requires authentication)
curl -X POST http://localhost:8080/ai-agents/marketing/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"brief":"test"}'
```

## Troubleshooting

### Services not starting
- Check that all entrypoint scripts are executable
- Verify port conflicts (4020-4023 should be available)
- Check docker logs: `docker-compose logs ai-overview-service`

### API Gateway routing issues
- Verify environment variables in docker-compose.yml
- Check that API Gateway is routing to correct ports
- Review api-gateway logs: `docker-compose logs api-gateway`

### Frontend connection issues
- Verify NEXT_PUBLIC_API_URL in .env points to gateway
- Check browser console for CORS errors
- Ensure services are accessible from gateway network

## Migration Notes

### Database
All AI agent services share the same database schema and run Alembic migrations on startup. The first service to start will handle migrations, subsequent services will see that migrations are already applied.

### Knowledge Base
The knowledge base is shared across all agents and managed through the Overview service.

### Session Management
Sessions are shared across agents and managed through the Overview service's orchestration endpoints.