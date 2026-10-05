// Player levels and loot boxes (docs/equipment.md §4.1): the experience bar, and opening the boxes it pays.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse, requireUser, type AppContext } from '../app.js';
import { awardXp, openBox, progressOf } from '../progression.js';

export function progressRoutes(ctx: AppContext) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', requireUser);

    /** The player's level, progress into it and unopened loot boxes. */
    app.get('/api/progress', async (req) => progressOf(ctx.db, ctx.content, req.user!.id));

    /** Opens a loot box: its three rolls are paid (gold, or gear into the inventory). */
    app.post('/api/loot-boxes/:id/open', async (req) => {
      const userId = req.user!.id;
      const { id } = parse(z.object({ id: z.uuid() }), req.params);
      const opened = await openBox(ctx.db, ctx.content, userId, id, ctx.rollSeed());
      return { ...opened, progress: await progressOf(ctx.db, ctx.content, userId) };
    });

    if (ctx.devGrants) {
      /** Development: adds experience (and pays its bubbles) without playing. */
      app.post('/api/dev/xp', async (req) => {
        const { xp } = parse(z.object({ xp: z.number().int().min(1).max(100_000) }), req.body);
        const gain = await awardXp(ctx.db, ctx.content, req.user!.id, xp);
        return { gain, progress: await progressOf(ctx.db, ctx.content, req.user!.id) };
      });
    }
  };
}
