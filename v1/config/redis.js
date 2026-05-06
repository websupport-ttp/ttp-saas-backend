// v1/config/redis.js
const { createClient } = require('redis');
const logger = require('../utils/logger');

// Environment prefix — isolates keys between prod/staging/test/dev on a shared Redis instance
const ENV_PREFIX = process.env.NODE_ENV === 'production'  ? 'prod'
                 : process.env.NODE_ENV === 'staging'     ? 'stg'
                 : process.env.NODE_ENV === 'test'        ? 'tst'
                 : 'dev';

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info(`Redis Client Connected [env: ${ENV_PREFIX}]`));
redisClient.on('ready', () => logger.info('Redis Client Ready'));
redisClient.on('end', () => logger.info('Redis Client Disconnected'));

// Prefix every key with the environment so all 4 environments can share one Redis instance.
// e.g.  "airportdb:airports:all"  →  "prod:airportdb:airports:all"
const prefixKey = (key) => `${ENV_PREFIX}:${key}`;

// Wrap get/set/del with automatic prefixing so no other file needs to change
const get = async (key) => redisClient.get(prefixKey(key));
const set = async (key, value, options) => redisClient.set(prefixKey(key), value, options);
const del = async (key) => redisClient.del(prefixKey(key));

// Expose the raw client for cases that need it (connect/disconnect/ping)
// plus the prefixed helpers and the prefix itself
redisClient.prefixKey = prefixKey;
redisClient.prefixedGet = get;
redisClient.prefixedSet = set;
redisClient.prefixedDel = del;
redisClient.envPrefix = ENV_PREFIX;

module.exports = redisClient;
