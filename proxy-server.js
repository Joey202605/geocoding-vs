const http = require('http');
const https = require('https');

const PORT = 3000;

// 简单的 CORS 代理，专为 Smarty API 设计
const server = http.createServer((req, res) => {
    // CORS 头 - 允许任何来源
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 只代理 /api/smarty 路径
    if (!req.url.startsWith('/api/smarty')) {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    // 构造 Smarty API URL
    const smartyPath = req.url.replace('/api/smarty', '');
    const targetUrl = `https://us-street.api.smartystreets.com/street-address${smartyPath}`;

    console.log(`[代理] → ${targetUrl}`);

    const proxyReq = https.get(targetUrl, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'AddressParser/1.0'
        }
    }, (proxyRes) => {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(body);
            console.log(`[代理] ← ${proxyRes.statusCode} (${body.length} bytes)`);
        });
    });

    proxyReq.on('error', (err) => {
        console.error(`[代理] 错误: ${err.message}`);
        res.writeHead(502);
        res.end(JSON.stringify({ error: `代理请求失败: ${err.message}` }));
    });

    proxyReq.setTimeout(15000, () => {
        proxyReq.destroy();
        res.writeHead(504);
        res.end(JSON.stringify({ error: '代理请求超时' }));
    });
});

server.listen(PORT, () => {
    console.log(`✅ Smarty 代理服务器已启动: http://localhost:${PORT}`);
    console.log(`   前端将 Smarty 请求发送到: http://localhost:${PORT}/api/smarty?...`);
    console.log(`   按 Ctrl+C 停止服务器`);
});
