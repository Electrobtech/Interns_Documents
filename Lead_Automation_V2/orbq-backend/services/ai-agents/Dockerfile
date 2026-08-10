# Build context is the orbq-backend/ root, so the shared packages/ are available.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# Dependencies first so a source edit doesn't invalidate the pip layer.
COPY services/ai-agents/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Shared packages, installed editable so imports resolve as orbq_core etc.
COPY packages/ /app/packages/
ENV PYTHONPATH=/app/packages/orbq-core:/app/packages/orbq-contracts:/app/packages/orbq-ai:/app/services/ai-agents

COPY services/ai-agents/ /app/services/ai-agents/

WORKDIR /app/services/ai-agents

EXPOSE 4020

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:4020/health/live || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4020"]
