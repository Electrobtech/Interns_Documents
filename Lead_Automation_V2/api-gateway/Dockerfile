FROM node:20-alpine
ENV NODE_OPTIONS=--openssl-legacy-provider
WORKDIR /app
COPY api-gateway ./
RUN npm install --omit=dev
CMD ["npm", "start"]
