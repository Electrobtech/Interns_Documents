FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer-cached unless requirements.txt changes)
COPY ai-agent-backend/requirements.txt ./requirements.txt
# Build hosts behind a TLS-inspecting proxy/AV present a re-signed certificate
# chain that pip rejects, which surfaces confusingly as "Could not find a
# version that satisfies the requirement" (pip cannot reach the index at all,
# so every package looks nonexistent). Registry traffic is already decrypted by
# that middlebox; --trusted-host only stops pip re-verifying it. Same class of
# workaround as npm's strict-ssl=false in frontend.Dockerfile.
RUN pip install --no-cache-dir --default-timeout=120 --retries 10 \
      --trusted-host pypi.org \
      --trusted-host files.pythonhosted.org \
      --trusted-host pypi.python.org \
      -r requirements.txt

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
