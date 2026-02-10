#!/bin/bash

# Tempest Weather Suite Setup Script
# This script helps you set up the project quickly

set -e  # Exit on error

echo "🌤️  Tempest Weather Suite Setup"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install Node.js 18 or higher from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js version is too old (found v$NODE_VERSION, need v18+)"
    echo "Please upgrade Node.js from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Backend setup
echo "📦 Setting up backend..."
cd backend

if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit backend/.env with your Tempest API credentials"
    echo ""
    read -p "Press Enter to open .env file in nano (or edit manually later): "
    nano .env || true
fi

echo "Installing backend dependencies..."
npm install

echo "✅ Backend setup complete!"
echo ""

# Dashboard setup
echo "📦 Setting up dashboard..."
cd ../apps/dashboard

echo "Installing dashboard dependencies..."
npm install

echo "✅ Dashboard setup complete!"
echo ""

# Summary
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Make sure you've configured backend/.env with your API credentials"
echo "   - TEMPEST_API_TOKEN"
echo "   - TEMPEST_STATION_ID"
echo "   - TEMPEST_LATITUDE"
echo "   - TEMPEST_LONGITUDE"
echo ""
echo "2. Start the backend server:"
echo "   cd backend"
echo "   npm run dev"
echo ""
echo "3. In a new terminal, start the dashboard:"
echo "   cd apps/dashboard"
echo "   npm start"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "For Raspberry Pi setup, see docs/setup-operations/raspberry-pi-setup.md"
echo "For Google Home setup, see docs/integrations/google-home-setup.md"
echo ""
echo "Happy weather tracking! 🌤️"
