import type { UseQueryResult } from 'convex/react';
import { useState } from 'react';

type RetainedQueryData<T> =
  | { hasData: false }
  | {
      hasData: true;
      data: T;
    };

type RetainedQueryCache<T> = {
  retentionKey: string;
  value: RetainedQueryData<T>;
};

const emptyRetainedQueryData = { hasData: false } as const;

export function useRetainedQueryData<T>(
  queryState: UseQueryResult<T>,
  retentionKey: string,
): RetainedQueryData<T> {
  const [cache, setCache] = useState<RetainedQueryCache<T>>({
    retentionKey,
    value: emptyRetainedQueryData,
  });

  if (
    queryState.status === 'success' &&
    (cache.retentionKey !== retentionKey ||
      !cache.value.hasData ||
      !Object.is(cache.value.data, queryState.data))
  ) {
    setCache({
      retentionKey,
      value: { hasData: true, data: queryState.data },
    });
  }

  if (queryState.status === 'success') {
    return { hasData: true, data: queryState.data };
  }

  if (cache.retentionKey === retentionKey) {
    return cache.value;
  }

  return emptyRetainedQueryData;
}
