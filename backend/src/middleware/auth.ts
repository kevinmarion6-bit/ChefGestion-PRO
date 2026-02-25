import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';

export interface AuthRequest extends Request {
  userId?: string;
  userToken?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Token manquant' });
    return;
  }
  const token = header.slice(7);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ ok: false, error: 'Token invalide ou expiré' });
      return;
    }
    req.userId = data.user.id;
    req.userToken = token;
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Erreur vérification token' });
  }
}
