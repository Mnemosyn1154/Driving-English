const http = require('http');
const express = require('express');
const cors = require('cors');

// Create Express app
const app = express();

// Enable CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3003',
  credentials: true,
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Driving English WebSocket Server',
  });
});

// WebSocket status endpoint
app.get('/api/websocket/status', (req, res) => {
  const wsServer = global.wsServer;
  res.json({
    connected: wsServer ? true : false,
    clients: wsServer ? wsServer.getConnectedClientsCount() : 0,
    authenticated: wsServer ? wsServer.getAuthenticatedClientsCount() : 0,
    uptime: process.uptime(),
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server (will be loaded dynamically)
let DrivingWebSocketServer;
try {
  // Try to load the WebSocket server class
  const wsModule = require('./dist/src/server/websocket-server.js');
  DrivingWebSocketServer = wsModule.DrivingWebSocketServer;
} catch (error) {
  console.warn('WebSocket server module not found, running in basic mode');
}

// Start server
server.listen(3001, '0.0.0.0', () => {
  console.log('Driving English Server running on http://localhost:3001');
  
  // Initialize WebSocket server if available
  if (DrivingWebSocketServer) {
    try {
      const wsServer = new DrivingWebSocketServer({
        server,
        path: '/api/voice/stream',
        jwtSecret: process.env.JWT_SECRET,
        corsOrigin: process.env.CORS_ORIGIN,
      });
      
      global.wsServer = wsServer;
      console.log('WebSocket server initialized on ws://localhost:3001/api/voice/stream');
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
    }
  } else {
    console.log('WebSocket server not available - run npm run build to enable');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (global.wsServer) {
    global.wsServer.close();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  if (global.wsServer) {
    global.wsServer.close();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});