FROM node:22-slim
WORKDIR /app
COPY server ./server
COPY www ./www
ENV PORT=3000 DB_PATH=/data/app.db TRUST_PROXY=1
VOLUME /data
EXPOSE 3000
CMD ["node", "server/src/index.js"]
