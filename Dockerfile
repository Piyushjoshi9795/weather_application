# ── Stage 1: Builder ─────────────────────────────────────
# We use a two-stage build:
# Stage 1 installs ALL packages (including dev tools)
# Stage 2 copies only what's needed for production
# Result: final image is much smaller (no dev dependencies)

# FROM = base image we start with
# node:20-alpine = Node.js 20 on Alpine Linux (tiny, only 5MB vs 900MB for full Ubuntu)
FROM node:20-alpine AS builder

# WORKDIR = all following commands run inside this folder
# (like doing cd /app inside the container)
WORKDIR /app

# Copy package files FIRST (before copying your code)
# Why? Docker caches each step. If package.json didn't change,
# Docker skips npm install on the next build — much faster!
COPY package*.json ./ 

# Install ALL dependencies (including devDependencies for building)
RUN npm ci
 # why npm ci?  npm ci is preferred for CI/CD pipelines because it installs dependencies based on the exact versions specified in package-lock.json, ensuring consistent and reproducible builds. It also runs faster than npm install because it skips certain steps like generating a new lock file or checking for updates, making it ideal for automated environments where you want to ensure that the same dependencies are installed every time without any surprises. 

# npm ci = like npm install but:
# - Uses exact versions from package-lock.json
# - Faster and more reliable for CI/CD
# - Fails if lock file is out of sync

# Copy the rest of your source code
COPY . .

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Set environment to production
# This tells Express, npm, and many libraries to optimize for prod
ENV NODE_ENV=production

# Copy package files again
COPY package*.json ./

# Install ONLY production dependencies (no jest, nodemon, etc.)
# --omit=dev skips devDependencies → smaller image
RUN npm ci --omit=dev

# Copy built code from Stage 1
# We only copy what's needed — not node_modules from stage 1
COPY --from=builder /app .

# EXPOSE tells Docker "this container listens on port 5000"
# (it's documentation — doesn't actually open the port)
EXPOSE 5000

# Create a non-root user for security
# Running as root inside containers is a security risk
RUN addgroup -S appgroup && adduser -S appuser -G appgroup 
USER appuser
# Creates a new user named "appuser" and adds it to the "appgroup" group. The -S flag creates a system user (without a home directory), and -G specifies the group to which the user belongs. This is a common practice in Dockerfiles to avoid running the application as the root user, which can be a security risk if the container is compromised.

# HEALTHCHECK = Docker periodically runs this to check if app is healthy
# If it fails 3 times, Docker marks the container as unhealthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# CMD = the command that runs when container starts
# Use array format (not string) — more reliable signal handling
CMD ["node", "server.js"]