import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      enabled: false,
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/game/AsteroidsGame.ts',
        'src/input/layout.ts',
        'src/graphics/phosphorMath.ts',
        'src/graphics/settings.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
        'src/input/layout.ts': { lines: 95, functions: 95, statements: 95, branches: 85 },
        'src/graphics/phosphorMath.ts': { lines: 95, functions: 100, statements: 95, branches: 85 },
      },
    },
  },
});
