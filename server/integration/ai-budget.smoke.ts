import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapRuntime } from '../bootstrap/startup.js';
import { initializePrisma, prisma, resetPrismaForTests } from '../prisma.js';
import { aiBudgetRepository, AI_BUDGET_DEFAULT_USER } from '../repositories/ai-budget.repository.js';
import { aiUsageRepository } from '../repositories/ai-usage.repository.js';

// Budget AI (V4 — cost control): verifica la logica che alimenta l'enforcement
// (limite risolto per utente: override → default → nessuno) e la somma della spesa
// odierna. Non richiede chiave AI: prepara direttamente righe budget e log costi.

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

test('Budget AI: limite risolto (override/default) e spesa odierna', async (t) => {
  const runtimeEnv = bootstrapRuntime();
  initializePrisma(runtimeEnv.databaseUrl);

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    t.skip(`Database non raggiungibile: ${(error as Error).message}`);
    return;
  }

  const suffix = `${Date.now()}-${Math.floor(process.hrtime()[1] % 1_000_000)}`;
  let workspaceId: string | null = null;
  const createdUserIds: string[] = [];

  try {
    const workspace = await prisma.workspace.create({
      data: { name: 'AI Budget Smoke', slug: `ai-budget-${suffix}` },
    });
    workspaceId = workspace.id;

    // Utenti reali: AiUsageLog.userId ha una FK verso User.
    const userA = await prisma.user.create({ data: { email: `override-${suffix}@test.local` } });
    const userB = await prisma.user.create({ data: { email: `default-${suffix}@test.local` } });
    createdUserIds.push(userA.id, userB.id);
    const userWithOverride = userA.id;
    const userDefault = userB.id;

    // Default del workspace = 5 USD/giorno; override utente = 2 USD/giorno.
    await aiBudgetRepository.upsert(workspace.id, AI_BUDGET_DEFAULT_USER, 5);
    await aiBudgetRepository.upsert(workspace.id, userWithOverride, 2);

    const overrideLimit = await aiBudgetRepository.resolveLimitForUser(workspace.id, userWithOverride);
    assert.equal(overrideLimit.dailyLimitUsd, 2);
    assert.equal(overrideLimit.source, 'user');

    const defaultLimit = await aiBudgetRepository.resolveLimitForUser(workspace.id, userDefault);
    assert.equal(defaultLimit.dailyLimitUsd, 5);
    assert.equal(defaultLimit.source, 'default');

    // Rimuovendo il default, un utente senza override non ha limite.
    await aiBudgetRepository.remove(workspace.id, AI_BUDGET_DEFAULT_USER);
    const noneLimit = await aiBudgetRepository.resolveLimitForUser(workspace.id, userDefault);
    assert.equal(noneLimit.dailyLimitUsd, 0);
    assert.equal(noneLimit.source, 'none');

    // Spesa odierna: due chiamate loggate oggi per l'utente con override.
    const logCost = (userId: string, costUsd: number) =>
      prisma.aiUsageLog.create({
        data: {
          workspaceId: workspace.id,
          userId,
          functionName: 'test',
          model: 'text-embedding-3-small',
          inputTokens: 100,
          outputTokens: 0,
          costUsd,
          durationMs: 1,
          status: 'success',
        },
      });
    await logCost(userWithOverride, 1.25);
    await logCost(userWithOverride, 0.75);
    await logCost(userDefault, 0.4);

    const spent = await aiUsageRepository.sumCostForUser(workspace.id, userWithOverride, startOfToday());
    assert.ok(Math.abs(spent - 2.0) < 1e-6, `spesa attesa 2.0, ottenuta ${spent}`);

    const spentMap = await aiUsageRepository.sumCostByUserSince(workspace.id, startOfToday());
    assert.ok(Math.abs((spentMap[userWithOverride] ?? 0) - 2.0) < 1e-6);
    assert.ok(Math.abs((spentMap[userDefault] ?? 0) - 0.4) < 1e-6);

    // Simula il controllo di enforcement: 2.0 speso >= limite 2 → bloccato.
    assert.ok(spent >= 2, 'lo speso deve raggiungere/superare il limite override');
  } finally {
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    await resetPrismaForTests();
  }
});
