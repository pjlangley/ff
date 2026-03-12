ARG PYTHON_VERSION=3.12.4

FROM python:${PYTHON_VERSION}
WORKDIR /usr/src/app
COPY --from=ghcr.io/astral-sh/uv:0.10.8 /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen
COPY fragments/ ./fragments/
EXPOSE 3003

ENTRYPOINT ["uv", "run"]
CMD ["python", "-m", "fragments.api"]
