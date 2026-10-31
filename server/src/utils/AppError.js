export class AppError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
export const badRequest = (m, d, c = 'BAD_REQUEST') => new AppError(400, c, m, d);
export const unauthorized = (m = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'Forbidden') => new AppError(403, 'FORBIDDEN', m);
export const notFound = (m = 'Not found') => new AppError(404, 'NOT_FOUND', m);
export const conflict = (m, d, c = 'CONFLICT') => new AppError(409, c, m, d);
export const unavailable = (m, c = 'SERVICE_UNAVAILABLE', d) => new AppError(503, c, m, d);
