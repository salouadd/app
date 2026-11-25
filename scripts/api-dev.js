import { createServer } from 'node:http';
import sessionHandler from '../api/session.js';
import checkInsHandler from '../api/check-ins.js';
import resultsHandler from '../api/results.js';
import leaderboardHandler from '../api/leaderboard.js';

const routes = new Map([
  ['/api/session', sessionHandler],
  ['/api/check-ins', checkInsHandler],
  ['/api/results', resultsHandler],
  ['/api/leaderboard', leaderboardHandler],
]);
const maximumBodyBytes = 16 * 1024;

function responseAdapter(response) {
  return {
    status(statusCode) {
      response.statusCode = statusCode;
      return this;
    },
    json(value) {
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('cache-control', 'no-store');
      response.end(JSON.stringify(value));
    },
  };
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  let text = '';
  for await (const chunk of request) {
    text += chunk;
    if (Buffer.byteLength(text) > maximumBodyBytes) {
      throw Object.assign(new Error('La requête est trop volumineuse.'), { status: 413 });
    }
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error('Le corps de la requête doit être un JSON valide.'), { status: 400 });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const handler = routes.get(url.pathname);
  if (!handler) {
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Route introuvable.' }));
    return;
  }
  try {
    request.body = await readBody(request);
    request.query = Object.fromEntries(url.searchParams.entries());
    await handler(request, responseAdapter(response));
  } catch (error) {
    if (error.status) {
      response.writeHead(error.status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
      return;
    }
    console.error('Erreur du serveur de développement API.', error);
    if (!response.writableEnded) {
      response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Erreur interne du serveur.' }));
    }
  }
});

const port = Number(process.env.PORT || 3001);
server.listen(port, '0.0.0.0', () => {
  console.log(`API locale disponible sur le port ${port}. Configure .env.local pour la connecter à Supabase.`);
});

process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
