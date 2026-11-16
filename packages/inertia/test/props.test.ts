import { expect, test } from 'bun:test';
import { request } from '#test/probe';

import { INERTIA, headers, probeOf } from './support.ts';

test('the page object carries merge, scroll and history metadata', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/props', { headers: INERTIA });
    expect(response.body).toMatchObject({
      clearHistory: true,
      deepMergeProps: ['deep'],
      matchPropsOn: { merged: 'id', 'scroll.data': 'id' },
      mergeProps: ['merged', 'scroll.data'],
      prependProps: ['prepended'],
      props: {
        always: 'always',
        deep: { nested: 1 },
        merged: [{ id: 1 }],
        prepended: [1],
        scroll: { currentPage: 1, data: [{ id: 1 }], nextPage: 2 },
      },
      scrollProps: {
        scroll: {
          currentPage: 1,
          nextPage: 2,
          pageName: 'page',
          reset: false,
        },
      },
    });
    expect(response.body).not.toHaveProperty('props.optional');
  } finally {
    await probe.close();
  }
});

test('an optional prop resolves only when requested and always resolves on every pass', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/props', {
      headers: headers({
        'X-Inertia-Partial-Component': 'Props/Index',
        'X-Inertia-Partial-Data': 'optional',
      }),
    });
    expect(response.body).toMatchObject({ props: { always: 'always', optional: 'optional' } });
    expect(response.body).not.toHaveProperty('props.merged');
  } finally {
    await probe.close();
  }
});

test('a reset scroll prop is unlabeled and marked for reset', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/props', {
      headers: headers({
        'X-Inertia-Partial-Component': 'Props/Index',
        'X-Inertia-Partial-Data': 'scroll',
        'X-Inertia-Reset': 'scroll',
      }),
    });
    expect(response.body).toMatchObject({ scrollProps: { scroll: { reset: true } } });
    expect(response.body).not.toHaveProperty('mergeProps');
  } finally {
    await probe.close();
  }
});

test('the merge intent prepends rather than appends', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/props', {
      headers: headers({
        'X-Inertia-Infinite-Scroll-Merge-Intent': 'prepend',
        'X-Inertia-Partial-Component': 'Props/Index',
        'X-Inertia-Partial-Data': 'scroll',
      }),
    });
    expect(response.body).toMatchObject({ prependProps: ['scroll.data'] });
  } finally {
    await probe.close();
  }
});

test('encryptHistory is emitted when the action asks for it', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/encrypt', { headers: INERTIA });
    expect(response.body).toMatchObject({ encryptHistory: true });
  } finally {
    await probe.close();
  }
});
