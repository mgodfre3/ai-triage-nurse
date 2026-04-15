# =============================================================================
# AI Triage Nurse — Multi-stage Dockerfile
# Runs a FastAPI app with Foundry Local for AI model inference.
# =============================================================================

# --------------- Stage 1: build dependencies ---------------
FROM python:3.12-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --------------- Stage 2: runtime image ---------------
FROM python:3.12-slim

# Install system dependencies (ffmpeg for audio processing, curl for healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder stage
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application code
COPY app/ ./app/
COPY static/ ./static/

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /home/appuser -s /sbin/nologin appuser && \
    mkdir -p /home/appuser/.foundry-local && \
    chown -R appuser:appuser /app /home/appuser

USER appuser

EXPOSE 8080

# Healthcheck — retries every 30s, gives 60s for initial startup
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Repo metadata
LABEL org.opencontainers.image.source="https://github.com/YOUR_ORG/ai-triage-nurse" \
      org.opencontainers.image.description="AI Triage Nurse demo app" \
      org.opencontainers.image.licenses="MIT"

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
