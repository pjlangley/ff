ARG PYTHON_VERSION=3.12.4

FROM python:${PYTHON_VERSION}
ENV REPO_NAME=ff
WORKDIR /usr/src/app
COPY mypy.ini .
COPY pylintrc .
COPY pyproject.toml .
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY fragments/ ./fragments/
EXPOSE 3003

ENTRYPOINT ["python"]
CMD ["-m", "fragments.api"]
