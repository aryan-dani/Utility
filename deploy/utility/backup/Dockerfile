FROM alpine:3.21

# postgresql-client provides pg_dump/pg_restore; restic for offsite; supercronic for cron.
RUN apk add --no-cache \
      bash \
      curl \
      ca-certificates \
      tzdata \
      restic \
      postgresql-client \
  && ARCH="$(uname -m)" \
  && case "$ARCH" in \
       x86_64)  SC_ARCH=amd64; SC_SHA256="feefa310da569c81b99e1027b86b27b51e6ee9ab647747b49099645120cfc671" ;; \
       aarch64) SC_ARCH=arm64; SC_SHA256="f1f8585c66de020fef494dd636058f99949d108f569fef00016a1c8b9eb145b3" ;; \
       *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;; \
     esac \
  && SUPERCRONIC_URL="https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-${SC_ARCH}" \
  && curl -fsSL -o /usr/local/bin/supercronic "$SUPERCRONIC_URL" \
  && echo "${SC_SHA256}  /usr/local/bin/supercronic" | sha256sum -c - \
  && chmod +x /usr/local/bin/supercronic \
  && printf '%s\n' '0 0 * * * true' > /tmp/cron.test \
  && /usr/local/bin/supercronic -test /tmp/cron.test \
  && rm /tmp/cron.test

COPY backup.sh restore-test.sh crontab /app/
RUN chmod +x /app/backup.sh /app/restore-test.sh \
  && sed -i 's/\r$//' /app/backup.sh /app/restore-test.sh /app/crontab

WORKDIR /app
ENV TZ=Asia/Kolkata
ENV PATH="/usr/local/bin:/usr/bin:/bin"

CMD ["/usr/local/bin/supercronic", "-passthrough-logs", "/app/crontab"]
