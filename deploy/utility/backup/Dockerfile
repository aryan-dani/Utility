FROM alpine:3.21
RUN apk add --no-cache bash curl postgresql17-client restic supercronic ca-certificates tzdata \
  && curl -fsSL -o /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc \
  && chmod +x /usr/local/bin/mc || true
COPY backup.sh restore-test.sh crontab /app/
RUN chmod +x /app/backup.sh /app/restore-test.sh
WORKDIR /app
ENV TZ=Asia/Kolkata
CMD ["supercronic", "/app/crontab"]
