# ASHA Sathi ML serving image.
#
# Build from the repository root so both apps/ml-training and packages/ml-common
# are in the build context:
#
#   docker build -f apps/ml-training/Dockerfile -t asha-sathi-ml .

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# Minimal build deps for onnxruntime wheel compilation if wheels are missing.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY apps/ml-training/requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt \
    && pip install "fastapi" "uvicorn[standard]"

# Shared feature-spec package used by the serving layer.
COPY packages/ml-common /ml-common
RUN pip install /ml-common

COPY apps/ml-training/src ./src
COPY apps/ml-training/artifacts ./artifacts

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/health')"

CMD ["uvicorn", "src.serving.inference:app", "--host", "0.0.0.0", "--port", "8000"]
