FROM alpine:3.21

# postgresql-client provides pg_dump/pg_restore; restic for offsite; supercronic for cron.
RUN apk add --no-cache \
      bash \
      curl \
      ca-certificates \
      tzdata \
      restic \
      postgresql-client \
  && SUPERCRONIC_URL="https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-amd64" \
  && curl -fsSL -o /usr/local/bin/supercronic "$SUPERCRONIC_URL" \
  && chmod +x /usr/local/bin/supercronic \
  && /usr/local/bin/supercronic -test <<< "0 0 * * * true"

COPY backup.sh restore-test.sh crontab /app/
RUN chmod +x /app/backup.sh /app/restore-test.sh \
  && sed -i 's/\r$//' /app/backup.sh /app/restore-test.sh /app/crontab

WORKDIR /app
ENV TZ=Asia/Kolkata
ENV PATH="/usr/local/bin:/usr/bin:/bin"

CMD ["/usr/local/bin/supercronic", "-passthrough-logs", "/app/crontab"]
