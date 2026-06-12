const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;

// pkg 打包后 __dirname 指向虚拟快照，实际文件在 exe 同级目录
// 用 process.cwd() 作为基础路径，兼容开发和打包两种模式
const BASE_DIR = fs.existsSync(path.join(__dirname, 'index.html'))
    ? __dirname
    : process.cwd();

// MIME 类型映射
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ===== Smarty API 代理 =====
    if (req.url.startsWith('/api/smarty')) {
        const smartyPath = req.url.replace('/api/smarty', '');
        const targetUrl = `https://us-street.api.smartystreets.com/street-address${smartyPath}`;

        console.log(`[Smarty] → ${targetUrl}`);

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
                console.log(`[Smarty] ← ${proxyRes.statusCode}`);
            });
        });

        proxyReq.on('error', (err) => {
            console.error(`[Smarty] 错误: ${err.message}`);
            res.writeHead(502);
            res.end(JSON.stringify({ error: `代理请求失败: ${err.message}` }));
        });

        proxyReq.setTimeout(15000, () => {
            proxyReq.destroy();
            res.writeHead(504);
            res.end(JSON.stringify({ error: '代理请求超时' }));
        });
        return;
    }

    // ===== 静态文件服务 =====
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(BASE_DIR, filePath);

    // 安全检查：防止目录遍历
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║    📍 地址解析对比工具 v1.0          ║');
    console.log('  ║                                      ║');
    console.log(`  ║    👉 ${url}              ║`);
    console.log('  ║                                      ║');
    console.log('  ║    按 Ctrl+C 或关闭此窗口停止         ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');

    // 自动打开浏览器
    const platform = process.platform;
    let cmd;
    if (platform === 'win32') {
        cmd = `start "" "${url}"`;
    } else if (platform === 'darwin') {
        cmd = `open "${url}"`;
    } else {
        cmd = `xdg-open "${url}"`;
    }
    exec(cmd, () => {});
});
