/**
 * Spotibai E2E Test Suite Runner
 * Executes Tier 1 (Features), Tier 2 (Boundaries), Tier 3 (Pairwise), and Tier 4 (Scenarios).
 */
import { startVitest } from 'vitest/node';

export async function runE2ESuite() {
  console.log('====================================================');
  console.log('   Spotibai E2E & Integration Test Suite Runner     ');
  console.log('   Tiers 1-4: Category-Partition, BVA, Pairwise     ');
  console.log('====================================================\n');

  const testFiles = [
    'tests/e2e/tier1-features.test.ts',
    'tests/e2e/tier2-boundaries.test.ts',
    'tests/e2e/tier3-pairwise.test.ts',
    'tests/e2e/tier4-scenarios.test.ts',
  ];

  const vitest = await startVitest('test', testFiles, {
    run: true,
  });

  if (!vitest) {
    console.error('Failed to start Vitest runner.');
    process.exit(1);
  }

  // Vitest will run and output summary
}

if (process.argv[1] && process.argv[1].endsWith('runner.ts')) {
  runE2ESuite().catch((err) => {
    console.error('Test Runner encountered fatal error:', err);
    process.exit(1);
  });
}
