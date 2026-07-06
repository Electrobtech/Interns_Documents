FROM node:20-alpine
WORKDIR /app
COPY api-gateway ./
RUN npm install --omit=dev
CMD ["npm", "start"]
