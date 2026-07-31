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

# FIX: NEXT_PUBLIC_* vars are inlined by Next.js at build time, not read at
# container start — the old Dockerfile had no ARG/ENV for this, so `npm run
# build` below always fell back to the code's hardcoded default
# (http://localhost:8080) no matter what NEXT_PUBLIC_API_URL was set to in
# docker-compose.yml's `environment:` block. Pass it in as a build arg
# instead (see the matching docker-compose.yml `build.args` change).
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the Next.js application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Set environment variable for Next.js port
ENV PORT=3000

# Start the production server on port 3000
CMD ["npm", "start"]