/**
 * jobQueue.js — Phase 0E. Background job queue with Redis fallback.
 *
 * Why a queue at all:
 *   - The vendor-approval email and the post-merge notifications
 *     fire inside HTTP requests. If SMTP is slow, the user waits.
 *   - Image processing and Shopify stock sync are CPU/IO heavy and
 *     would be better as background workers.
 *   - Anything time-sensitive that we don't want a 502 to lose
 *     (e.g. "send order receipt") should be enqueued and retried.
 *
 * Why a fallback:
 *   - On dev (no Redis), we run jobs IN-PROCESS, synchronously,
 *     so dev still works without needing Redis to be running.
 *   - On prod (REDIS_URL set), we use BullMQ — durable, retried,
 *     observable, scale-out via separate workers.
 *
 * The two modes share the same `enqueue()` API; callers don't
 * care which is active.
 *
 *   await enqueue('sendVendorApproval', { vendorId, email }, {
 *     attempts: 3,
 *     backoff: { type: 'exponential', delay: 5000 },
 *   });
 *
 * Workers are registered with `register(name, handler)`. If a job
 * is enqueued before a worker is registered, the in-process mode
 * stores it and runs it on the first registration; BullMQ mode
 * will keep the job in the queue and run it when the worker
 * starts.
 */

const handlers = new Map(); // job name -> async (data) => any
const pending = []; // jobs enqueued before their handler was registered (in-proc mode only)
let bullmq = null;
let bullmqConnection = null;
let _mode = 'inproc';
let _initialized = false;

function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

async function init() {
  if (_initialized) return;
  _initialized = true;
  if (!isRedisConfigured()) {
    _mode = 'inproc';
    return;
  }
  try {
    const BQ = require('bullmq');
    bullmq = BQ;
    const IORedis = require('ioredis');
    bullmqConnection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requires this
    });
    _mode = 'bullmq';
    console.log('[jobQueue] using BullMQ + Redis');
  } catch (e) {
    console.warn('[jobQueue] bullmq/ioredis not installed, falling back to in-proc:', e.message);
    _mode = 'inproc';
  }
}

function register(name, handler) {
  if (typeof handler !== 'function') {
    throw new Error(`register: handler for "${name}" must be a function`);
  }
  handlers.set(name, handler);

  // In BullMQ mode, attach the worker for this job.
  if (_mode === 'bullmq' && bullmq) {
    const worker = new bullmq.Worker(
      name,
      async (job) => handler(job.data, job),
      { connection: bullmqConnection },
    );
    worker.on('failed', (job, err) => {
      console.error(`[jobQueue] ${name} failed:`, err.message);
    });
    // Keep a reference so it doesn't get GC'd.
    workers.set(name, worker);
  }

  // In-proc mode: drain any pending jobs for this name.
  if (_mode === 'inproc') {
    const idx = pending.findIndex((j) => j.name === name);
    while (idx !== -1) {
      const job = pending[idx];
      pending.splice(idx, 1);
      runInproc(job);
      break; // run only one at a time per register call
    }
  }
}

const workers = new Map();

async function runInproc(job) {
  const handler = handlers.get(job.name);
  if (!handler) {
    pending.push(job);
    return;
  }
  try {
    await handler(job.data, { name: job.name, id: job.id });
  } catch (e) {
    console.error(`[jobQueue/inproc] ${job.name} failed:`, e.message);
    if (job.opts && job.opts.attempts && job.attempts < job.opts.attempts) {
      // naive retry
      const delay = (job.opts.backoff && job.opts.backoff.delay) || 1000;
      setTimeout(() => runInproc({ ...job, attempts: job.attempts + 1 }), delay);
    }
  }
}

async function enqueue(name, data = {}, opts = {}) {
  await init();
  if (_mode === 'bullmq' && bullmq) {
    const queue = new bullmq.Queue(name, { connection: bullmqConnection });
    const job = await queue.add(name, data, opts);
    return { ok: true, mode: 'bullmq', id: job.id };
  }
  // in-proc
  const id = `inproc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  runInproc({ name, data, opts, attempts: 1, id });
  return { ok: true, mode: 'inproc', id };
}

function mode() {
  return _mode;
}

function getHandlers() {
  return new Map(handlers);
}

// expose for tests
function _reset() {
  handlers.clear();
  pending.length = 0;
  workers.clear();
  bullmq = null;
  bullmqConnection = null;
  _mode = 'inproc';
  _initialized = false;
  for (const m of ['bullmq', 'ioredis']) {
    try { delete require.cache[require.resolve(m)]; } catch (_) { /* not installed */ }
  }
}

module.exports = { enqueue, register, mode, getHandlers, _reset, init };