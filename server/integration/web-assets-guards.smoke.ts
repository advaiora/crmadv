import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../app.js';

const TEST_HOST = '127.0.0.1';

const startTestServer = async () => {
  const app = createApp({ logger: false });
  await app.listen({ host: TEST_HOST, port: 0 });
  const address = app.server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Unable to read test server address');
  }

  return {
    app,
    baseUrl: `http://${TEST_HOST}:${address.port}`,
  };
};

const stopTestServer = async (app: FastifyInstance | null) => {
  if (app) {
    await app.close();
  }
};

test('web-assets endpoints require authentication and do not return 500 when unauthenticated', async () => {
  let app: FastifyInstance | null = null;

  try {
    const server = await startTestServer();
    app = server.app;

    const responses = await Promise.all([
      fetch(`${server.baseUrl}/web-assets`),
      fetch(`${server.baseUrl}/web-assets/lookups/clients`),
      fetch(`${server.baseUrl}/web-assets/non-existent-id`),
      fetch(`${server.baseUrl}/web-assets/non-existent-id/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ published: true }),
      }),
      fetch(`${server.baseUrl}/web-assets/non-existent-id`, {
        method: 'DELETE',
      }),
    ]);

    for (const response of responses) {
      assert.notEqual(response.status, 500);
      assert.equal(response.status, 401);
    }
  } finally {
    await stopTestServer(app);
  }
});
