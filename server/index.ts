import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { GameService } from './game-service.ts';
import { wallet } from './wallet.ts';

const app = express();
const service = new GameService();
const sessions = new Map<string, number>();
const port = Number(process.env.PORT || 8787);
const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, 'http://127.0.0.1:5173', 'http://localhost:5173']);
app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const host = req.hostname;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return res.status(403).json({ error: 'Local test-wallet access only' });
  if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) return res.status(403).json({ error: 'Origin is not permitted' });
  if (req.method !== 'GET' && req.headers['x-kennel-request'] !== '1') return res.status(403).json({ error: 'Missing request header' });
  next();
});
app.get('/api/health', async (_req, res) => {
  try { const info = await (await wallet()).walletGetInfo(); res.json({ network: info.network, walletReady: true }); }
  catch { res.json({ network: 'esmeralda', walletReady: false }); }
});
app.post('/api/connect', async (_req, res) => {
  const state = await service.state();
  const token = randomBytes(32).toString('hex');
  for (const [key, expires] of sessions) if (expires < Date.now()) sessions.delete(key);
  sessions.set(token, Date.now() + 3600_000);
  res.cookie('kennel_session', token, { httpOnly: true, sameSite: 'strict', maxAge: 3600_000 });
  res.json(state);
});
app.use('/api', (req, res, next) => {
  const token = /(?:^|;\s*)kennel_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  if (!token || (sessions.get(token) || 0) < Date.now()) return res.status(401).json({ error: 'Connect your local test wallet to continue' });
  next();
});
app.post('/api/disconnect', (req, res) => { const token = /kennel_session=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1]; if (token) sessions.delete(token); res.clearCookie('kennel_session'); res.json({ ok: true }); });
app.get('/api/state', async (_req, res) => res.json(await service.state()));
app.post('/api/incubations', async (req, res) => {
  const { door, id } = z.object({ door: z.number().int().min(0).max(2), id: z.string().regex(/^[a-f0-9]{32}$/) }).strict().parse(req.body);
  res.status(202).json(await service.start(door, id));
});
const idSchema = z.string().regex(/^[a-f0-9]{32}$/);
app.post('/api/incubations/:id/resume', async (req, res) => { await service.resume(idSchema.parse(req.params.id)); res.status(202).json({ ok: true }); });
app.post('/api/incubations/:id/open', async (req, res) => res.json(await service.preview(idSchema.parse(req.params.id))));
app.post('/api/incubations/:id/hatch', async (req, res) => res.json(await service.hatch(idSchema.parse(req.params.id))));
app.use(express.static(resolve('dist')));
app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Request failed';
  res.status(error instanceof z.ZodError ? 400 : 503).json({ error: message.slice(0, 600) });
});
app.listen(port, '127.0.0.1', () => console.log(`Midnight Kennel API: http://127.0.0.1:${port}`));
