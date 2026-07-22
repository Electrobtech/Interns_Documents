FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/automation-service ./services/automation-service
WORKDIR /app/services/automation-service
RUN npm install --omit=dev
CMD ["npm", "start"]
