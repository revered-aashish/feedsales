import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'feedsales_default_secret_change_me_2024';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function dispatchOrAdmin(req, res, next) {
  if (req.user.role === 'admin' || req.user.is_dispatch_manager) {
    return next();
  }
  return res.status(403).json({ error: 'Dispatch manager or admin access required' });
}

// Returns a WHERE clause fragment + params array that scopes data to the user's region.
// alias = the salesman table alias used in the calling query.
export function regionClause(user, regionParam, alias = 's') {
  if (user.role === 'admin') {
    if (regionParam) return { sql: ` AND ${alias}.region = ?`, params: [regionParam] };
    return { sql: '', params: [] };
  }
  if (user.region) return { sql: ` AND ${alias}.region = ?`, params: [user.region] };
  // Salesman with no region assigned — restrict to own rows only
  return { sql: ` AND ${alias}.id = ?`, params: [user.id] };
}
