FROM python:3.12.4
ENV REPO_NAME=ff
WORKDIR /usr/src/app
COPY mypy.ini .
COPY pylintrc .
COPY pyproject.toml .
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY fragments/ ./fragments/
ENTRYPOINT ["python"]
CMD ["-m", "fragments.main"]
