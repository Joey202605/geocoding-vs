const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = 3456;

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// 静态文件服务
function serveStatic(req, res) {
  const parsedUrl = url.parse(req.url);
  let filePath = path.join(__dirname, 'public', parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}

// 代理请求函数
function proxyRequest(protocol, options, postData, callback) {
  const lib = protocol === 'https:' ? https : http;
  const req = lib.request(options, (proxyRes) => {
    let body = '';
    proxyRes.on('data', (chunk) => { body += chunk; });
    proxyRes.on('end', () => {
      callback(null, proxyRes.statusCode, body);
    });
  });

  req.on('error', (err) => {
    callback(err);
  });

  if (postData) {
    req.write(postData);
  }
  req.end();
}

// API 路由处理
function handleAPI(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Google Geocoding API 代理
  if (pathname === '/api/google-geocode') {
    const address = parsedUrl.query.address;
    const key = parsedUrl.query.key;

    if (!address || !key) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '缺少 address 或 key 参数' }));
      return;
    }

    const apiUrl = `/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const options = {
      hostname: 'maps.googleapis.com',
      path: apiUrl,
      method: 'GET',
    };

    proxyRequest('https:', options, null, (err, statusCode, body) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求 Google API 失败: ' + err.message }));
        return;
      }
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(body);
    });
    return;
  }

  // Smarty Street Address API 代理
  if (pathname === '/api/smarty-address') {
    const q = parsedUrl.query;
    // 前端传的参数名是 street, city, state, zipcode, auth_id, auth_token
    const street = q.street || q.address || '';
    const city = q.city || '';
    const state = q.state || '';
    const zipcode = q.zipcode || '';
    const authId = q.auth_id || '';
    const authToken = q.auth_token || '';

    if (!authId || !authToken) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '缺少 auth_id 或 auth_token 参数' }));
      return;
    }

    if (!street) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '缺少 street 参数' }));
      return;
    }

    const queryParts = [];
    queryParts.push(`auth-id=${encodeURIComponent(authId)}`);
    queryParts.push(`auth-token=${encodeURIComponent(authToken)}`);
    queryParts.push(`street=${encodeURIComponent(street)}`);
    if (city) queryParts.push(`city=${encodeURIComponent(city)}`);
    if (state) queryParts.push(`state=${encodeURIComponent(state)}`);
    if (zipcode) queryParts.push(`zipcode=${encodeURIComponent(zipcode)}`);
    queryParts.push('candidates=1');
    queryParts.push('match=invalid');

    const apiUrl = `/street-address?${queryParts.join('&')}`;
    const options = {
      hostname: 'us-street.api.smarty.com',
      path: apiUrl,
      method: 'GET',
    };

    console.log(`[Smarty] 请求地址: street=${street}, city=${city}, state=${state}, zipcode=${zipcode}`);
    console.log(`[Smarty] 完整URL: ${options.hostname}${apiUrl.replace(authId, '***').replace(authToken, '***')}`);

    proxyRequest('https:', options, null, (err, statusCode, body) => {
      if (err) {
        console.log(`[Smarty] 请求错误: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求 Smarty API 失败: ' + err.message }));
        return;
      }
      console.log(`[Smarty] 状态码: ${statusCode}, 响应: ${body.slice(0, 300)}`);
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(body);
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'API 端点未找到' }));
}

// 创建服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);

  if (parsedUrl.pathname.startsWith('/api/')) {
    handleAPI(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`地址解析对比工具已启动: http://localhost:${PORT}`);
});
