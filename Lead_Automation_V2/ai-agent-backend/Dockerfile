FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer-cached unless requirements.txt changes)
COPY ai-agent-backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --default-timeout=120 --retries 10 -r requirements.txt

# Copy application code
COPY ai-agent-backend/app ./app

# Copy Alembic migration files
COPY ai-agent-backend/alembic ./alembic
COPY ai-agent-backend/alembic.ini ./alembic.ini

# Copy entrypoint script
COPY ai-agent-backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 4005

ENTRYPOINT ["./entrypoint.sh"]
