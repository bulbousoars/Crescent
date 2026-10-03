import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ fail: false, calls: 0 }));
vi.mock('../src/lib/prisma', () => ({ prisma: { $queryRaw: () => {
  state.calls += 1;
  if (state.fail) throw new Error('database unavailable');
  return Promise.resolve([{ '?column?': 1 }]);
} } }));
import { GET } from '../src/app/api/health/route';

describe('health endpoint', () => {
  beforeEach(() => { state.fail = false; state.calls = 0; });

  it('reports healthy only when the database answers', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(state.calls).toBe(1);
  });

  it('reports unavailable when the database fails', async () => {
    state.fail = true;
    const response = await GET();
    expect(response.status).toBe(503);
  });
});
