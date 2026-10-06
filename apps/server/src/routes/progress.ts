// Player levels and loot boxes (docs/equipment.md §4.1): the experience bar, and opening the boxes it pays.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { HttpError, parse, requireUser, type AppContext } from '../app.js';
import { guideRewards } from '../db/schema.js';
import { grant, inTransaction } from '../economy.js';
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

    /** The menu guides this account has finished (each was paid when first finished). */
    app.get('/api/guides', async (req) => {
      const rows = await ctx.db.select({ id: guideRewards.guideId }).from(guideRewards).where(eq(guideRewards.userId, req.user!.id));
      return { done: rows.map((r) => r.id) };
    });

    /**
     * Records a finished menu guide and pays its reward (economy `guideRewards`) the first time the account finishes it;
     * later calls pay nothing (`reward: null`). The guides run in the browser, so this trusts the
     * client that the guide was finished, and only guards against paying twice.
     */
    app.post('/api/guides/:id/complete', async (req) => {
      const userId = req.user!.id;
      const { id } = parse(z.object({ id: z.string().min(1).max(40) }), req.params);
      const spec = ctx.content.economy.guideRewards?.[id];
      if (!spec) throw new HttpError(404, 'No such guide');
      const reward = await inTransaction(ctx.db, async (db) => {
        const claimed = await db.insert(guideRewards).values({ userId, guideId: id }).onConflictDoNothing().returning();
        return claimed.length ? grant(db, ctx.content, userId, spec, 'guide') : null;
      });
      return { reward, progress: await progressOf(ctx.db, ctx.content, userId) };
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
