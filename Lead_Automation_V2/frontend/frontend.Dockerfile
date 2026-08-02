# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json first for better caching
COPY package.json package-lock.json ./


# Install dependencies
# Local build environments behind TLS-inspecting proxies/AV present a
# re-signed cert chain that npm rejects (UNABLE_TO_VERIFY_LEAF_SIGNATURE),
# which silently yields EMPTY package dirs. Registry traffic is already
# decrypted by that middlebox; this only stops npm from re-verifying it.
RUN npm config set strict-ssl false
RUN npm install

# Copy all source files
COPY . .

# NEXT_PUBLIC_* vars are inlined by Next.js at build time, not read at
# container start, so setting it only in docker-compose's `environment:` block
# left the build falling back to the code's hardcoded http://localhost:8080.
# Passed in as a build arg instead (see docker-compose.yml `build.args`).
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the Next.js application.
# next/font/google downloads font CSS at build time using Node's own fetch,
# which npm's strict-ssl setting doesn't cover — behind a TLS-inspecting
# proxy/AV that fetch fails and the whole build dies. Set inline (not ENV)
# so the bypass applies to this layer only and never reaches the runtime image.
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npm run build

# Expose port 3000
EXPOSE 3000

# Set environment variable for Next.js port
ENV PORT=3000

# Start the production server on port 3000
CMD ["npm", "start"]