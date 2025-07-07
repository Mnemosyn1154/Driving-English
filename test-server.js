const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<h1>Driving English - Test Server Running on port 3001!</h1>');
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Test server running on http://localhost:3001');
});