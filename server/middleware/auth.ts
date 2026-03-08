import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'megawatt-dashboard-secret-2026';

export interface AuthRequest extends Request {
  adminId?: number;
  adminUsername?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
    req.adminId = payload.id;
    req.adminUsername = payload.username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
