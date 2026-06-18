FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends     build-essential     libpq-dev     && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv     --mount=type=bind,source=pyproject.toml,target=pyproject.toml     --mount=type=bind,source=uv.lock,target=uv.lock     uv sync --frozen --no-install-project --no-dev

# Copy source code
COPY . .

# Install the project
RUN --mount=type=cache,target=/root/.cache/uv     uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
