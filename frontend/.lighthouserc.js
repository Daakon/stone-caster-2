/**
 * Phase 6: Lighthouse CI configuration for a11y smoke tests
 */

module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/game/test-game-id', 'http://localhost:4173/new-game'],
      startServerCommand: 'pnpm preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 10000,
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }], // a11y score >= 95
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
      },
    },
  },
};

