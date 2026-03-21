import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import os from 'os';

// Routes
import authRoutes       from './routes/auth';
import scanRoutes       from './routes/scan';
import invoicesRoutes   from './routes/invoices';
import suppliersRoutes  from './routes/suppliers';
import haccpRoutes      from './routes/haccp';
import dashboardRoutes  from './routes/dashboard';
import fridgesRouter    from './routes/fridges';
import restaurantRouter from './routes/restaurant';
import { supabase }     from './services/supabase';
import settingsRouter   from './routes/settings';
import archivesRouter   from './routes/archives';
import fichesRouter     from './routes/fiches';
import photoArchivesRouter from './routes/photoArchives';
import { runArchiveCron, runIncompleteMonthNotification } from './services/archiveGenerator';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── MIDDLEWARES ─────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ─── ROUTES ──────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/scan',       scanRoutes);
app.use('/api/invoices',   invoicesRoutes);
app.use('/api/suppliers',  suppliersRoutes);
app.use('/api/haccp',      haccpRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/fridges',    fridgesRouter);
app.use('/api/restaurant', restaurantRouter);
app.use('/api/settings',   settingsRouter);
app.use('/api/archives',   archivesRouter);
app.use('/api/fiches',     fichesRouter);
app.use('/api/photo-archives', photoArchivesRouter);

// ─── HEALTH CHECK ────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  // Test connexion Supabase
  const { error } = await supabase.from('profiles').select('id').limit(1);
  res.json({
    ok: true,
    data: {
      status: 'running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      supabase: !error,
      gemini: !!(process.env.GEMINI_API_KEY),
    },
  });
});

// ─── 404 ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Route introuvable' });
});

// ─── ERROR HANDLER ───────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ ok: false, error: err.message || 'Erreur serveur' });
});

// ─── START ───────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  // Afficher toutes les IPs locales pour faciliter la config Expo
  const nets = os.networkInterfaces();
  const localIPs: string[] = [];
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) localIPs.push(iface.address);
    }
  }

  // Cron : Archives + Notifications (au démarrage puis toutes les 6h)
  setTimeout(() => {
    runArchiveCron().catch(console.error);
    runIncompleteMonthNotification().catch(console.error);
  }, 10000);

  setInterval(() => {
    runArchiveCron().catch(console.error);
    runIncompleteMonthNotification().catch(console.error);
  }, 6 * 60 * 60 * 1000);
});

export default app;
