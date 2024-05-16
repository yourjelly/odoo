/**
 * Returns a promise resolved after 'wait' milliseconds
 *
 * @param {int} [wait=0] the delay in ms
 * @return {Promise}
 */
export function delay(wait) {
    return new Promise(function (resolve) {
        setTimeout(resolve, wait);
    });
}

/**
 * Deferred is basically a resolvable/rejectable extension of Promise.
 */
export class Deferred extends Promise {
    constructor() {
        let resolve;
        let reject;
        const prom = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return Object.assign(prom, { resolve, reject });
    }
}

/**
 * KeepLast is a concurrency primitive that manages a list of tasks, and only
 * keeps the last task active.
 *
 * @template T
 */
export class KeepLast {
    constructor() {
        this._def = null;
    }

    /**
     * Register a new task
     *
     * @param {Promise<T>} promise
     * @returns {Promise<T>}
     */
    async add(promise) {
        const def = new Deferred();
        this._def = def;

        return promise.finally(() => {
            if (this._def === def) {
                def.resolve();
            }
            return def;
        });
    }
}

/**
 * A (Odoo) mutex is a primitive for serializing computations.  This is
 * useful to avoid a situation where two computations modify some shared
 * state and cause some corrupted state.
 *
 * Imagine that we have a function to fetch some data _load(), which returns
 * a promise which resolves to something useful. Now, we have some code
 * looking like this::
 *
 *      return this._load().then(function (result) {
 *          this.state = result;
 *      });
 *
 * If this code is run twice, but the second execution ends before the
 * first, then the final state will be the result of the first call to
 * _load.  However, if we have a mutex::
 *
 *      this.mutex = new Mutex();
 *
 * and if we wrap the calls to _load in a mutex::
 *
 *      return this.mutex.exec(function() {
 *          return this._load().then(function (result) {
 *              this.state = result;
 *          });
 *      });
 *
 * Then, it is guaranteed that the final state will be the result of the
 * second execution.
 *
 * A Mutex has to be a class, and not a function, because we have to keep
 * track of some internal state.
 */
export class Mutex {
    constructor() {
        this._def = null;
        this._unlockDef = null;
    }

    /**
     * Add a computation to the queue, it will be executed as soon as the
     * previous computations are completed.
     *
     * @param {() => (void | Promise<void>)} action a function which may return a Promise
     * @returns {Promise<void>}
     */
    async exec(action) {
        const previousDef = this._def;
        const def = new Deferred();
        this._def = def;
        await previousDef;

        if (!this._unlockDef) {
            this._unlockDef = new Deferred();
        }

        return Promise.resolve(action()).finally(() => {
            def.resolve();

            if (def === this._def) {
                this._unlockDef.resolve();
                this._unlockDef = null;
            }
        });
    }
    /**
     * @returns {Promise<void>} resolved as soon as the Mutex is unlocked
     *   (directly if it is currently idle)
     */
    getUnlockedDef() {
        return this._unlockDef ?? Promise.resolve();
    }
}

/**
 * Race is a class designed to manage concurrency problems inspired by
 * Promise.race(), except that it is dynamic in the sense that promises can be
 * added anytime to a Race instance. When a promise is added, it returns another
 * promise which resolves as soon as a promise, among all added promises, is
 * resolved. The race is thus over. From that point, a new race will begin the
 * next time a promise will be added.
 *
 * @template T
 */
export class Race {
    constructor() {
        this._def = null;
    }
    /**
     * Register a new promise. If there is an ongoing race, the promise is added
     * to that race. Otherwise, it starts a new race. The returned promise
     * resolves as soon as the race is over, with the value of the first resolved
     * promise added to the race.
     *
     * @param {Promise<T>} promise
     * @returns {Promise<T>}
     */
    add(promise) {
        if (!this._def) {
            this._def = new Deferred();
        }

        promise.then(this._def.resolve, this._def.reject).finally(() => {
            this._def = null;
        });

        return this._def;
    }
    /**
     * @returns {Promise<T>|null} promise resolved as soon as the race is over, or
     *   null if there is no race ongoing)
     */
    getCurrentProm() {
        return this._def;
    }
}
