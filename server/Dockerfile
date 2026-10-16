# Protestat relay: tiny, no dependencies. Stores only encrypted blobs, deletes them after TTL_HOURS.
FROM node:22-alpine
WORKDIR /app
COPY relay.mjs .
ENV PORT=8787 HOST=0.0.0.0 DATA_DIR=/data TTL_HOURS=72
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "relay.mjs"]
