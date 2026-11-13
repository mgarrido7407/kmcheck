import type { ErrorRequestHandler } from 'express';
import { logger } from '../logger.js';
import type { ApiError } from '../schemas/index.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.parse.failed') {
    const body: ApiError = { error: 'El cuerpo de la solicitud no es JSON válido' };
    res.status(400).json(body);
    return;
  }
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Solicitud demasiado grande' } satisfies ApiError);
    return;
  }
  logger.error('Error no controlado', err);
  res.status(500).json({ error: 'Error interno del servidor' } satisfies ApiError);
};
