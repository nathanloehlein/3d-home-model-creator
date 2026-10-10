FROM node:22-alpine

WORKDIR /app

ENV PORT=8080
ENV PREVIEW_HOST=0.0.0.0

COPY --chown=node:node package.json model.html ./
COPY --chown=node:node tools/build.mjs tools/serve.mjs tools/
COPY --chown=node:node assets assets

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["npm", "start"]
