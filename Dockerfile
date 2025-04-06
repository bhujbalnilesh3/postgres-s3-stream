# Use Node.js as base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install --only=prod

# Copy the ETL script
COPY . .

# Command to run the script
CMD ["node", "app.js"]
