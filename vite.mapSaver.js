// Pomocník vývojového serveru — editor mapy přes něj ukládá výsledek rovnou do souboru v projektu.
// Funguje jen při vývoji; přijme hotovou mapu a přepíše soubor mapy, nic jiného na disku nemění.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MAP_DIR = fileURLToPath(new URL('./src/data/maps/', import.meta.url));
const ENDPOINT = '/_map';
const BODY_LIMIT = 8 * 1024 * 1024;

const HOT_FILE = `${MAP_DIR}glade/map.json`;

export default function mapSaver() {
  return {
    name: 'greenfactory-map-saver',
    apply: 'serve',
    configureServer(server) {
      const isHot = (file) => file.split('\\').join('/') === HOT_FILE.split('\\').join('/');
      server.watcher.on('change', (file) => {
        if (!isHot(file)) return;
        server.ws.send({ type: 'full-reload' });
      });
      server.middlewares.use(ENDPOINT, (req, res) => {
        if (req.method === 'POST' && req.headers['x-map-read'] === '1') {
          readMap(res);
          return;
        }
        if (req.method !== 'POST') {
          send(res, 405, { error: 'metoda není povolená' });
          return;
        }
        let size = 0;
        const chunks = [];
        req.on('data', (chunk) => {
          size += chunk.length;
          if (size > BODY_LIMIT) {
            send(res, 413, { error: 'mapa je příliš velká' });
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        req.on('end', async () => {
          const mapKey = String(req.url || '').replace(/^\/+/, '');
          const problem = checkMapKey(mapKey);
          if (problem) {
            send(res, 400, { error: problem });
            return;
          }
          let body;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            send(res, 400, { error: 'tělo není platná mapa' });
            return;
          }
          if (!isMapFile(body)) {
            send(res, 400, { error: 'tělo nevypadá jako mapa' });
            return;
          }
          try {
            await writeFile(`${MAP_DIR}${mapKey}/map.json`, JSON.stringify(body), 'utf8');
          } catch {
            send(res, 500, { error: 'zápis do souboru selhal' });
            return;
          }
          send(res, 200, { ok: true });
        });
      });
    },
  };
}

function checkMapKey(mapKey) {
  if (!mapKey) return 'chybí název mapy';
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(mapKey)) return 'neplatný název mapy';
  return null;
}

function isMapFile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (typeof body.mapKey !== 'string') return false;
  if (checkMapKey(body.mapKey)) return false;
  return ['floor', 'path', 'water', 'decorations'].every((name) => Array.isArray(body[name]));
}

function readMap(res) {
  readFile(HOT_FILE, 'utf8')
    .then((text) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(text);
    })
    .catch(() => send(res, 404, { error: 'soubor mapy chybí' }));
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
