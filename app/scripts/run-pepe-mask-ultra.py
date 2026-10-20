"""Operational V3 scheduler: original workers/science unchanged, five CPU lanes.

The original runner, protocol, models, receipts and scientific registration are
never rewritten by this adapter. Only dispatch concurrency and its lease change.
"""
import concurrent.futures
import fcntl
import importlib
import json
import os
import re
import subprocess
import time

legacy = importlib.import_module('run-pepe-mask')
core = legacy.core
ROOT, RUN = core.ROOT, core.RUN
CONFIG_PATH = RUN / 'runtime-config.json'
_memory_cache = {'at': 0.0, 'percent': None}
_original_publish = legacy.publish


def effective_capacity(control, config, now_ms, memory_percent=None):
    requested = control.get('mode', 'eco')
    if requested not in config['profiles']:
        raise ValueError('Unregistered operational mode')
    expiry = control.get('ultraExpiresAt')
    expired = requested == 'ultra' and (not isinstance(expiry, (int, float)) or now_ms >= expiry)
    mode = 'eco' if expired else requested
    workers = config['profiles'][mode]['workers']
    memory_limited = False
    if memory_percent is not None:
        limit = 1 if memory_percent < config['memoryCriticalPercent'] else config['profiles']['boost']['workers'] if memory_percent < config['memorySoftPercent'] else workers
        memory_limited = limit < workers
        workers = min(workers, limit)
    return {'requestedMode': requested, 'effectiveMode': mode, 'workers': workers,
            'threadsPerWorker': config['threadsPerWorker'], 'maximumWorkers': config['maximumWorkers'],
            'memoryAvailablePercent': memory_percent, 'memoryLimited': memory_limited,
            'ultraExpiresAt': expiry, 'ultraExpired': expired,
            'scientificProtocolChanged': False}


def available_memory_percent():
    now = time.monotonic()
    if now - _memory_cache['at'] >= 10:
        try:
            r = subprocess.run(['/usr/bin/memory_pressure', '-Q'], capture_output=True, text=True, timeout=3)
            match = re.search(r'System-wide memory free percentage:\s*(\d+)%', r.stdout)
            _memory_cache.update(at=now, percent=int(match.group(1)) if match and r.returncode == 0 else None)
        except (OSError, subprocess.TimeoutExpired):
            _memory_cache.update(at=now, percent=None)
    return _memory_cache['percent']


def snapshot(config):
    value = effective_capacity(legacy.control(), config, int(time.time()*1000), available_memory_percent())
    # If the memory monitor is unavailable, conservatively retain normal turbo capacity.
    if value['memoryAvailablePercent'] is None and value['workers'] > config['profiles']['boost']['workers']:
        value.update(workers=config['profiles']['boost']['workers'], memoryLimited=True)
    value.update(version=config['version'], pid=os.getpid(), updatedAt=int(time.time()*1000),
                 originalRegistrationSHA256=config['originalRegistrationSHA256'],
                 startedWorkers=sum(worker is not None and worker.p.poll() is None for worker in [w.worker for w in legacy.WORKERS]),
                 busyWorkers=sum(w.busy for w in legacy.WORKERS))
    return value


class WorkerSlot:
    def __init__(self, number):
        self.n = number
        self.worker = None
        self.busy = False

    def call(self, job):
        if self.worker is None:
            self.worker = legacy.Worker(self.n)
        self.busy = True
        try:
            return self.worker.call(job)
        finally:
            self.busy = False

    def close(self):
        if self.worker is not None:
            self.worker.close()
            self.worker = None


def dispatch(jobs, callback, workers, *, lock, capacity, paused, guard, sleep=time.sleep):
    queue = iter(jobs)
    def lane(worker):
        while True:
            inactive = False
            with lock:
                if completed.is_set() or paused() or guard():
                    return
                inactive = worker.n >= capacity()
                if not inactive:
                    job = next(queue, None)
                    if job is None:
                        return
            if inactive:
                # A finished worker releases its cached Node/Python memory in light modes.
                worker.close()
                with lock:
                    # A sentinel-free exhaustion check is unnecessary while active lanes
                    # run; completion signals below release waiting lanes.
                    if completed.is_set():
                        return
                sleep(.25)
                continue
            value = worker.call(job)
            with lock:
                callback(value, job, worker)
    completed = __import__('threading').Event()
    # Active lanes can finish while others await a higher mode. Once every job
    # has been accepted, waiting lanes must exit rather than keep a generation open.
    remaining = [len(jobs)]
    original_callback = callback
    def accept(value, job, worker):
        original_callback(value, job, worker)
        remaining[0] -= 1
        if remaining[0] == 0:
            completed.set()
    callback = accept
    if not jobs:
        return
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(workers)) as pool:
        futures = [pool.submit(lane, w) for w in workers]
        try:
            for f in concurrent.futures.as_completed(futures):
                f.result()
        except BaseException:
            completed.set()
            raise


def main():
    config = core.read(CONFIG_PATH)
    if config['threadsPerWorker'] != core.P['threadsPerWorker'] or config['maximumWorkers'] > max(1, (os.cpu_count() or 1)//config['threadsPerWorker']):
        raise ValueError('Runtime exceeds registered CPU capacity')
    if core.sha(RUN/'registration.json') != config['originalRegistrationSHA256']:
        raise ValueError('Original registration mismatch')
    for path, digest in config['sourceHashes'].items():
        if core.sha(ROOT/path) != digest:
            raise ValueError('Operational runtime changed; register a new runtime version')
    legacy.verify()
    with (RUN/'runtime-coordinator.lock').open('a') as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        for n in range(config['maximumWorkers']):
            legacy.WORKERS.append(WorkerSlot(n))
        def publish(state):
            runtime = snapshot(config)
            state['executionRuntime'] = runtime
            core.atomic(RUN/'runtime-status.json', runtime)
            _original_publish(state)
        legacy.publish = publish
        legacy.lanes = lambda jobs, callback: dispatch(jobs, callback, legacy.WORKERS, lock=legacy.LOCK,
            capacity=lambda:snapshot(config)['workers'], paused=legacy.paused, guard=legacy.guard)
        try:
            if not (RUN/'parent-selection.json').exists():
                raise ValueError('Ultra adapter requires the existing initialized population')
            if not legacy.paused():
                legacy.train()
        except Exception as error:
            previous = core.read(RUN/'status.json')
            publish({**previous, 'status': 'error', 'error': str(error)})
            raise
        finally:
            for worker in legacy.WORKERS:
                worker.close()


if __name__ == '__main__':
    main()
