FROM node:20-alpine
WORKDIR /app
COPY services/linkedin-service/package*.json ./
RUN npm install --omit=dev
COPY services/linkedin-service/src ./src
EXPOSE 4009
CMD ["node", "src/index.js"]
