FROM golang:1.23.1-alpine3.20
RUN apk add --no-cache curl bash
RUN curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh \
    | sh -s -- -b $(go env GOPATH)/bin v1.61.0
WORKDIR /usr/src/app
ENV REPO_NAME=ff
COPY .golangci.yaml .
COPY go.work .
COPY fragments ./fragments/
WORKDIR /usr/src/app/fragments
RUN go mod tidy
WORKDIR /usr/src/app
ENTRYPOINT ["go"]
CMD ["run", "fragments/main.go"]