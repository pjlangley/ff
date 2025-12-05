ARG GO_VERSION=1.23.1
ARG ALPINE_VERSION=3.20

FROM golang:${GO_VERSION}-alpine${ALPINE_VERSION}

ARG GO_CI_LINT_VERSION=1.61.0
ENV GO_CI_LINT_VERSION=${GO_CI_LINT_VERSION}

RUN apk add --no-cache curl bash
RUN curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh \
    | sh -s -- -b $(go env GOPATH)/bin v${GO_CI_LINT_VERSION}
WORKDIR /usr/src/app
ENV REPO_NAME=ff
COPY .golangci.yaml .
COPY go.work .
COPY fragments ./fragments/
WORKDIR /usr/src/app/fragments
RUN go mod tidy
WORKDIR /usr/src/app
RUN go build -v -o .bin/go_ff ./fragments/api.go
EXPOSE 3002

ENTRYPOINT [".bin/go_ff"]