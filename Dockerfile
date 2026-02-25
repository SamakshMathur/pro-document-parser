FROM node:20-bookworm-slim AS base

# Install Python and necessary dependencies for the Python PDF extraction script
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set up a Python virtual environment to install packages globally within Docker safely
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install pure Python dependencies needed for semantic parsing
RUN pip install --no-cache-dir pdfplumber pymupdf

# Set working directory inside the container
WORKDIR /app

# Copy package management files first for better caching
COPY package.json package-lock.json ./

# Install Node modules
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port Next.js will run on
EXPOSE 3000

# Start the Next.js application in production mode
CMD ["npm", "start"]
