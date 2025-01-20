FROM python:3.12.4
ENV REPO_NAME=ff
WORKDIR /usr/src/app
COPY mypy.ini .
COPY pylintrc .
COPY pyproject.toml .
COPY requirements.txt .
RUN python3 -m pip install -r requirements.txt
RUN touch /usr/local/lib/python3.12/site-packages/ff.pth
RUN pwd > /usr/local/lib/python3.12/site-packages/ff.pth
COPY fragments/ ./fragments/
ENTRYPOINT ["python3"]
CMD ["fragments/main.py"]
