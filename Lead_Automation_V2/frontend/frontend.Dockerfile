# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json first for better caching
COPY package.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build the Next.js application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Set environment variable for Next.js port
ENV PORT=3000

# Start the production server on port 3000
CMD ["npm", "start"]
