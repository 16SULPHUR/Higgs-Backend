# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory (no spaces in directory names)
WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose backend port
EXPOSE 8000

# Start app
CMD ["node", "build/index.js"]