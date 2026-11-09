/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { handleChatMessage } from './geminiService.ts';

export const apiRouter = Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, locationContext, rolePersona, groundingMode, model } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'Messages array is required.' });
    }

    const result = await handleChatMessage({
      messages,
      locationContext,
      rolePersona,
      groundingMode,
      model,
    });

    return res.json(result);
  } catch (err: unknown) {
    console.error('API /api/chat failure:', err);
    const msg = err instanceof Error ? err.message : 'Unknown server error';
    
    // Check for quota or rate limiting errors
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
      return res.status(429).json({
        error: 'RESOURCE_EXHAUSTED',
        message: 'Gemini API quota reached. Please try again shortly.',
      });
    }

    if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
      return res.status(403).json({
        error: 'AUTH_ERROR',
        message: 'Gemini API authentication failed. Please check the API key.',
      });
    }

    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: msg,
    });
  }
});
