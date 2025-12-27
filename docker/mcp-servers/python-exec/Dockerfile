FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for sandboxed Python execution
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Create sandbox user for secure execution
RUN useradd -m -s /bin/bash sandbox && \
    mkdir -p /sandbox && \
    chown sandbox:sandbox /sandbox

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
