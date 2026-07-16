const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.PORT !== undefined;
const CERT_DIR = path.join(__dirname, '.cert');
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file if missing
if (!fs.existsSync(DATA_FILE)) {
  const initialData = { machines: [], orders: [] };
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { machines: [], orders: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
  });
}

function handleRequest(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let url = req.url.split('?')[0];

  // API: Get all data
  if (url === '/api/data' && req.method === 'GET') {
    const data = readData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // API: Save all data (full sync)
  if (url === '/api/data' && req.method === 'POST') {
    parseBody(req).then(body => {
      writeData(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid data' }));
    });
    return;
  }

  // Static files
  let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// Start server
if (IS_PRODUCTION) {
  // Cloud: HTTP only (HTTPS handled by hosting platform)
  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`MAGIC server running on port ${PORT}`);
  });
} else {
  // Local: HTTPS with self-signed cert
  if (!fs.existsSync(path.join(CERT_DIR, 'cert.pem'))) {
    require('./gen-cert.js');
  }

  const options = {
    key: fs.readFileSync(path.join(CERT_DIR, 'key.pem')),
    cert: fs.readFileSync(path.join(CERT_DIR, 'cert.pem'))
  };

  const server = https.createServer(options, handleRequest);
  server.listen(PORT, '0.0.0.0', () => {
    const nets = require('os').networkInterfaces();
    let ip = 'localhost';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) { ip = net.address; break; }
      }
    }
    console.log('=========================================');
    console.log('  MAGIC - Servidor HTTPS activo');
    console.log('=========================================');
    console.log(`  Local:   https://localhost:${PORT}`);
    console.log(`  Celular: https://${ip}:${PORT}`);
    console.log('');
    console.log('  IMPORTANTE: El navegador va a avisar');
    console.log('  que el certificado no es confiable.');
    console.log('  Toca "Avanzado" > "Continuar" o');
    console.log('  "Proceed to site" para entrar.');
    console.log('=========================================');
  });
}
