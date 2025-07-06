import { NextRequest } from 'next/server';
import { Server } from 'http';
import { DrivingEnglishWebSocketServer } from '@/lib/websocket/server';

// Store WebSocket server instance
let wsServer: DrivingEnglishWebSocketServer | null = null;

// This is a special handler for WebSocket upgrade
export async function GET(request: NextRequest) {
  // Check if this is a WebSocket upgrade request
  const upgradeHeader = request.headers.get('upgrade');
  
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade request', { status: 400 });
  }

  // Note: In production Next.js deployment (like Vercel), 
  // WebSocket servers need special handling or a separate service
  // This is a development setup example
  
  return new Response('WebSocket endpoint ready', {
    status: 101,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    },
  });
}

// Initialize WebSocket server (called from server startup)
export function initializeWebSocketServer(httpServer: Server) {
  if (!wsServer) {
    wsServer = new DrivingEnglishWebSocketServer(httpServer);
    console.log('WebSocket server initialized');
  }
  return wsServer;
}

// Cleanup function
export async function cleanupWebSocketServer() {
  if (wsServer) {
    await wsServer.shutdown();
    wsServer = null;
  }
}

// Export server instance for use in other API routes
export function getWebSocketServer() {
  return wsServer;
}