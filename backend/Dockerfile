FROM python:3.11-slim-bullseye

# System deps: potrace + OpenCV runtime libs + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    potrace \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Temp directory for job results
RUN mkdir -p /tmp/pixelforge

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
