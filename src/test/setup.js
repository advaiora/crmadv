// Setup comune dei test frontend (Vitest, caricato via vite.config.js -> test.setupFiles).
// - aggancia i matcher di jest-dom (toBeInTheDocument, toHaveClass, ...) all'expect di Vitest;
// - pulisce il DOM dopo ogni test: senza `globals: true` la cleanup automatica di
//   Testing Library non si registra da sola, va fatta qui.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
