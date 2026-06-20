import Redis, { Cluster, ClusterNode } from 'ioredis';

export function getRedisClient(): Redis | Cluster {
  const mode = process.env.REDIS_MODE || 'standalone';
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const connectTimeout = 2000;

  if (mode === 'cluster') {
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      console.log('[Redis] Initializing in Cluster Mode');
    }
    const nodesStr = process.env.REDIS_NODES || '127.0.0.1:6379';
    const nodes: ClusterNode[] = nodesStr.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return { host, port: port ? parseInt(port, 10) : 6379 };
    });
    return new Redis.Cluster(nodes, {
      redisOptions: {
        connectTimeout,
        maxRetriesPerRequest: 1,
      },
      clusterRetryStrategy: () => null,
    });
  } else if (mode === 'sentinel') {
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      console.log('[Redis] Initializing in Sentinel Mode');
    }
    const sentinelsStr = process.env.REDIS_SENTINELS || '127.0.0.1:26379';
    const sentinels = sentinelsStr.split(',').map(sentinel => {
      const [host, port] = sentinel.trim().split(':');
      return { host, port: port ? parseInt(port, 10) : 26379 };
    });
    const sentinelName = process.env.REDIS_SENTINEL_NAME || 'mymaster';
    return new Redis({
      sentinels,
      name: sentinelName,
      connectTimeout,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
  } else {
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      console.log(`[Redis] Initializing in Standalone Mode connecting to ${url}`);
    }
    return new Redis(url, {
      connectTimeout,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
  }
}
