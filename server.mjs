/**
 * SEAF Feldhandbuch — lokaler Server.
 *
 * Liefert die statische Seite aus und bietet optional einen KI-Proxy
 * (OpenAI-kompatibel), damit der API-Key nicht im Browser landen muss.
 *
 * Start:  node server.mjs
 * Config: ai.config.json  (siehe ai.config.example.json)
 * Env:    HD2_AI_BASE_URL, HD2_AI_MODEL, HD2_AI_KEY, PORT, HD2_NO_OPEN
 */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let SERVER_PORT = Number(process.env.PORT || 4173);
const HOST = '127.0.0.1';
const START = Date.now();
const APP_ID = 'hd2-feldhandbuch';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

let ai = { baseUrl: '', model: '', apiKey: '', temperature: 0.25 };

async function loadAiConfig() {
  const file = path.join(ROOT, 'ai.config.json');
  let fileCfg = {};
  try {
    fileCfg = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`[ai] ai.config.json ist ungültig: ${err.message}`);
  }
  const baseUrl = String(process.env.HD2_AI_BASE_URL || fileCfg.baseUrl || '').replace(/\/+$/, '');
  const model = String(process.env.HD2_AI_MODEL || fileCfg.model || '');
  const apiKey = String(process.env.HD2_AI_KEY || fileCfg.apiKey || '');
  const temperature = Number(fileCfg.temperature ?? 0.25);
  ai = { baseUrl, model, apiKey, temperature: Number.isFinite(temperature) ? temperature : 0.25 };
  if (ai.baseUrl && ai.model) {
    console.log(`[ai] Proxy aktiv: ${ai.model} @ ${ai.baseUrl}${ai.apiKey ? '' : ' (ohne Key)'}`);
  } else {
    console.log('[ai] Kein Modell konfiguriert — nur lokaler Assistent.');
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit = 1_500_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Anfrage zu groß'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sanitizeMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const allowed = new Set(['system', 'user', 'assistant']);
  const out = [];
  for (const m of input.slice(-24)) {
    if (!m || !allowed.has(m.role) || typeof m.content !== 'string') continue;
    if (m.content.length > 24_000) continue;
    out.push({ role: m.role, content: m.content });
  }
  return out.length ? out : null;
}

async function handleChat(req, res) {
  if (!ai.baseUrl || !ai.model) {
    return json(res, 503, {
      error: {
        message: 'Kein KI-Modell auf dem Server konfiguriert. Lege ai.config.json an (siehe ai.config.example.json) und starte den Server neu.'
      }
    });
  }
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (err) {
    return json(res, 400, { error: { message: `Ungültige Anfrage: ${err.message}` } });
  }
  const messages = sanitizeMessages(payload.messages);
  if (!messages) return json(res, 400, { error: { message: 'messages fehlt oder ist leer' } });

  const upstream = `${ai.baseUrl}/chat/completions`;
  const headers = { 'content-type': 'application/json' };
  if (ai.apiKey) headers.authorization = `Bearer ${ai.apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let response;
  try {
    response = await fetch(upstream, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ai.model,
        messages,
        stream: true,
        temperature: ai.temperature
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    return json(res, 502, { error: { message: `Upstream nicht erreichbar: ${err.message}` } });
  }

  if (!response.ok) {
    clearTimeout(timer);
    const text = await response.text().catch(() => '');
    let message = `Upstream HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error?.message || parsed.message || message;
    } catch { if (text) message = `${message}: ${text.slice(0, 300)}`; }
    return json(res, 502, { error: { message } });
  }

  res.writeHead(200, {
    'content-type': response.headers.get('content-type') || 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no'
  });

  try {
    const reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('[ai] Stream-Fehler:', err.message);
  } finally {
    clearTimeout(timer);
    res.end();
  }
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.resolve(ROOT, `.${rel}`);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    return json(res, 403, { error: { message: 'Zugriff verweigert' } });
  }
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return json(res, 404, { error: { message: 'Nicht gefunden' } });
  }
  if (info.isDirectory()) return serveStatic(req, res, `${rel.replace(/\/+$/, '')}/index.html`);

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': info.size,
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin'
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  const buf = await readFile(filePath);
  res.end(buf);
}

async function handleRequest(req, res) {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${SERVER_PORT}`}`);
  const { pathname } = url;

  try {
    if (pathname === '/api/ai/status' && req.method === 'GET') {
      return json(res, 200, {
        app: APP_ID,
        port: SERVER_PORT,
        configured: Boolean(ai.baseUrl && ai.model),
        model: ai.model || null,
        baseUrl: ai.baseUrl || null,
        hasKey: Boolean(ai.apiKey),
        uptime: Math.round((Date.now() - START) / 1000)
      });
    }
    if (pathname === '/api/chat') {
      if (req.method !== 'POST') return json(res, 405, { error: { message: 'Nur POST' } });
      return await handleChat(req, res);
    }
    if (pathname.startsWith('/api/')) return json(res, 404, { error: { message: 'Unbekannte API-Route' } });
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
    return await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) json(res, 500, { error: { message: 'Interner Fehler' } });
    else res.end();
  } finally {
    if (pathname !== '/api/ai/status') {
      const ms = Date.now() - started;
      if (ms > 1500) console.log(`${req.method} ${pathname} — ${ms} ms`);
    }
  }
}

await loadAiConfig();

const noOpen = process.argv.includes('--no-open') || Boolean(process.env.HD2_NO_OPEN);
const basePort = Number(process.env.PORT || 4173);

function openBrowser(target) {
  if (noOpen) return;
  exec(`start "" "${target}"`, { windowsHide: true }, () => {});
}

function listenOn(port) {
  return new Promise((resolve, reject) => {
    const instance = http.createServer(handleRequest);
    const onError = (err) => {
      instance.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      instance.removeListener('error', onError);
      resolve(instance);
    };
    instance.once('error', onError);
    instance.once('listening', onListening);
    instance.listen(port, HOST);
  });
}

async function probeHandbook(port) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 800);
    const res = await fetch(`http://${HOST}:${port}/api/ai/status`, {
      signal: ctrl.signal,
      headers: { accept: 'application/json' }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.app === APP_ID ? data : null;
  } catch {
    return null;
  }
}

let active = null;
for (let port = basePort; port < basePort + 12; port++) {
  try {
    active = await listenOn(port);
    SERVER_PORT = port;
    break;
  } catch (err) {
    if (err.code !== 'EADDRINUSE') {
      console.error('\nServer konnte nicht starten:', err.message, '\n');
      process.exit(1);
    }
    const existing = await probeHandbook(port);
    if (existing) {
      const url = `http://${HOST}:${port}`;
      console.log('');
      console.log('  Das Feldhandbuch läuft bereits.');
      console.log(`  ${url}`);
      if (!noOpen) console.log('  Browser wird geöffnet …');
      console.log('');
      openBrowser(url);
      process.exit(0);
    }
    console.log(`  Port ${port} ist belegt — probiere ${port + 1}.`);
  }
}

if (!active) {
  console.error(`\nKein freier Port zwischen ${basePort} und ${basePort + 11} gefunden.`);
  console.error(`Starte mit anderem Port:  set PORT=4200 && node server.mjs\n`);
  process.exit(1);
}

const url = `http://${HOST}:${SERVER_PORT}`;
console.log('');
console.log('  SEAF FELDHANDBUCH');
console.log(`  ${url}`);
console.log('  Nochmal starten öffnet nur den Browser. Strg+C beendet den Server.');
console.log('');
openBrowser(url);

process.on('SIGINT', () => {
  console.log('\n  Server beendet.');
  active.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
});
