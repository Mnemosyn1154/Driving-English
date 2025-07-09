#!/bin/bash

# Development server runner with IPv4 priority
# This script ensures the server runs with proper IPv4 configuration

echo "🚀 Starting Driving English development server..."
echo "📍 Server will be available at: http://127.0.0.1:3003"
echo ""

# Kill any existing Next.js processes
echo "Cleaning up existing processes..."
pkill -f "next dev" 2>/dev/null

# Set environment to prefer IPv4
export NODE_OPTIONS='--dns-result-order=ipv4first'

# Change to project directory
cd "$(dirname "$0")/.." || exit 1

# Start the development server
echo "Starting Next.js with IPv4 priority..."
exec npm run dev