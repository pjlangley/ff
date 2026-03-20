ARG PYTHON_VERSION=3.12.4

FROM python:${PYTHON_VERSION}-slim-bookworm
WORKDIR /usr/src/app
COPY --from=ghcr.io/astral-sh/uv:0.10.8 /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY fragments/ ./fragments/
RUN adduser --disabled-password --gecos "" ff
USER ff
EXPOSE 3003
ENTRYPOINT ["uv", "run", "--no-sync"]
CMD ["python", "-m", "fragments.api"]
