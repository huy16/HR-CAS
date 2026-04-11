#!/usr/bin/env bash
# exit on error
set -o errexit

# Install backend dependencies
echo "Installing backend dependencies..."
cd ats-backend
npm install
cd ..

# Install frontend dependencies and build
echo "Installing frontend dependencies and building..."
cd ats-web
npm install
npm run build
cd ..

# Install Puppeteer browser if running on Render
if [ -n "$RENDER" ]; then
  echo "Installing Puppeteer browser for Render..."
  cd ats-backend
  npx puppeteer install
  cd ..
fi

echo "Build completed successfully!"
