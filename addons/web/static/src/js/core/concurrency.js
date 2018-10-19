odoo.define('web.concurrency', function (require) {
"use strict";

/**
 * Concurrency Utils
 *
 * This file contains a short collection of useful helpers designed to help with
 * everything concurrency related in Odoo.
 *
 * The basic concurrency primitives in Odoo JS are the callback, and the
 * promises.  Promises (deferred) are more composable, so we usually use them
 * whenever possible.  We use the jQuery implementation.
 *
 * Those functions are really nothing special, but are simply the result of how
 * we solved some concurrency issues, when we noticed that a pattern emerged.
 */

var Class = require('web.Class');

return {
    /**
     * The jquery implementation for $.when has a (most of the time) useful
     * property: it is synchronous, if the deferred is resolved immediately.
     *
     * This means that when we execute $.when(def), then all registered
     * callbacks will be executed before the next line is executed.  This is
     * useful quite often, but in some rare cases, we might want to force an
     * async behavior. This is the purpose of this function, which simply adds a
     * setTimeout before resolving the deferred.
     *
     * @returns {Deferred}
     */
    asyncWhen: function () {
        throw "only used in tests";
        var async = false;
        var def = $.Deferred();
        $.when.apply($, arguments).done(function () {
            var args = arguments;
            var action = function () {
                def.resolve.apply(def, args);
            };
            if (async) {
                action();
            } else {
                setTimeout(action, 0);
            }
        }).fail(function () {
            var args = arguments;
            var action = function () {
                def.reject.apply(def, args);
            };
            if (async) {
                action();
            } else {
                setTimeout(action, 0);
            }
        });
        async = true;
        return def;
    },
    /**
     * Returns a deferred resolved after 'wait' milliseconds
     *
     * @param {int} [wait=0] the delay in ms
     * @return {Deferred}
     */
    delay: function (wait) {
        return new Promise(function (resolve, reject) {
            setTimeout(resolve, wait);
        });
    },
    /**
     * The DropMisordered abstraction is useful for situations where you have
     * a sequence of operations that you want to do, but if one of them
     * completes after a subsequent operation, then its result is obsolete and
     * should be ignored.
     *
     * Note that is is kind of similar to the DropPrevious abstraction, but
     * subtly different.  The DropMisordered operations will all resolves if
     * they complete in the correct order.
     */
    DropMisordered: Class.extend({
        /**
         * @constructor
         *
         * @param {boolean} [failMisordered=false] whether mis-ordered responses
         *   should be failed or just ignored
         */
        init: function (failMisordered) {
            console.log("start drop misordered");
            // local sequence number, for requests sent
            this.lsn = 0;
            // remote sequence number, seqnum of last received request
            this.rsn = -1;
            this.failMisordered = failMisordered || false;
        },
        /**
         * Adds a deferred (usually an async request) to the sequencer
         *
         * @param {Deferred} deferred to ensure add
         * @returns {Deferred}
         */
        add: function (deferred) {
            console.log("add drop missordered")
            var self = this;
            var seq = this.lsn++;
            var res = new Promise(function(resolve, reject) {
                deferred.then(function(result) {
                    if (seq > self.rsn) {
                        self.rsn = seq;
                        resolve(result);
                    } else if (self.failMisordered) {
                        reject();
                    }
                }).catch(function(result) {
                    if (seq > self.rsn) {
                        self.rsn = seq;
                        resolve(result);
                    } else if (self.failMisordered) {
                        reject();
                    }
                    reject(result);
                });
            });
            return res;
            /*var res = $.Deferred();

            var self = this, seq = this.lsn++;
            deferred.done(function () {
                if (seq > self.rsn) {
                    self.rsn = seq;
                    res.resolve.apply(res, arguments);
                } else if (self.failMisordered) {
                    res.reject();
                }
            }).fail(function () {
                res.reject.apply(res, arguments);
            });

            return res.promise();
            */
        },
    }),
    /**
     * The DropPrevious abstraction is useful when you have a sequence of
     * operations that you want to execute, but you only care of the result of
     * the last operation.
     *
     * For example, let us say that we have a _fetch method on a widget which
     * fetches data.  We want to rerender the widget after.  We could do this::
     *
     *      this._fetch().then(function (result) {
     *          self.state = result;
     *          self.render();
     *      });
     *
     * Now, we have at least two problems:
     *
     * - if this code is called twice and the second _fetch completes before the
     *   first, the end state will be the result of the first _fetch, which is
     *   not what we expect
     * - in any cases, the user interface will rerender twice, which is bad.
     *
     * Now, if we have a DropPrevious::
     *
     *      this.dropPrevious = new DropPrevious();
     *
     * Then we can wrap the _fetch in a DropPrevious and have the expected
     * result::
     *
     *      this.dropPrevious
     *          .add(this._fetch())
     *          .then(function (result) {
     *              self.state = result;
     *              self.render();
     *          });
     */
    DropPrevious: Class.extend({
        /**
         * Registers a new deferred and rejects the previous one
         *
         * @param {Promise} promise the new deferred
         * @returns {Promise}
         */
        add: function (deferred) {
            console.log("add drop previous");

            if (this.currentDef) { this.currentDef.reject(); }
            var rejection;
            var res = new Promise(function (resolve, reject) {
                rejection = reject;
                deferred.then(resolve).catch(reject);
            });

            this.currentDef = res;
            this.currentDef.reject = rejection;
            this.currentDef.catch(function() {});

            return res;
        }
    }),
    /**
     * A (Odoo) mutex is a primitive for serializing computations.  This is
     * useful to avoid a situation where two computations modify some shared
     * state and cause some corrupted state.
     *
     * Imagine that we have a function to fetch some data _load(), which returns
     * a deferred which resolves to something useful. Now, we have some code
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
    Mutex: Class.extend({
        init: function () {
            this.lock = Promise.resolve();
        },
        /**
         * Add a computation to the queue, it will be executed as soon as the
         * previous computations are completed.
         *
         * @param {function} action a function which may return a deferred
         * @returns {Deferred}
         */
        exec: function (action) {
            var currentLock = this.lock;
            var result;
            this.lock = new Promise(function (unlockCurrent) {
                currentLock.then(function () {
                    result = action();
                    Promise.resolve(result)
                        .then(unlockCurrent)
                        .catch(unlockCurrent);
                });
            });

            return this.lock.then(function () {
                return result;
            });

            // var currentPromise = this.promise;

            // return new Promise(function (resolve) {

            //     return currentPromise.then(function () {
            //         var result = action();
            //         result
            //             .then(resolve)
            //             .catch(resolve);
            //         return result;
            //     });
            // });




            // PROPOSITION

            // var currentPromise = this.promise;
            // var nextResolver;

            // this.promise = new Promise(function (resolve) {
            //     nextResolver = resolve;
            // });

            // return currentPromise.then(function () {
            //     var result = action();
            //     result
            //         .then(nextResolver)
            //         .catch(nextResolver);
            //     return result;
            // });





            // INITIAL
            // this.current.then(function () {

            // this.def = $.Deferred();
            // var next = this.def;

            // var self = this;
            // var current = this.def;
            // var next = this.def = $.Deferred();
            // this.unlockedDef = this.unlockedDef || $.Deferred();
            // return current.done(function() {
            //     return $.when(action()).always(function () {
            //         next.resolve();
            //         if (self.def.state() === 'resolved' && self.unlockedDef) {
            //             self.unlockedDef.resolve();
            //             self.unlockedDef = undefined;
            //         }
            //     });
            // });
        },
        /**
         * @returns {Promise} resolved as soon as the Mutex is unlocked
         *   (directly if it is currently idle)
         */
        getUnlockedDef: function () {
            console.error("getUnlockedDef Not really implemented yet, but kinda ok");
            //throw new Error("Not implemented yet");
            return Promise.resolve(this.lock);
            // return $.when(this.unlockedDef);
        },
    }),
    /**
     * A MutexedDropPrevious is a primitive for serializing computations while
     * skipping the ones that where executed between a current one and before
     * the execution of a new one. This is useful to avoid useless RPCs.
     *
     * You can read the Mutex description to understand its role ; for the
     * DropPrevious part of this abstraction, imagine the following situation:
     * you have a code that call the server with a fixed argument and a list of
     * operations that only grows after each call and you only care about the
     * RPC result (the server code doesn't do anything). If this code is called
     * three times (A B C) and C is executed before B has started, it's useless
     * to make an extra RPC (B) if you know that it won't have an impact and you
     * won't use its result.
     *
     * Note that the promise returned by the exec call won't be resolved if
     * exec is called before the first exec call resolution ; only the promise
     * returned by the last exec call will be resolved (the other are rejected);
     *
     * A MutexedDropPrevious has to be a class, and not a function, because we
     * have to keep track of some internal state. The exec function takes as
     * argument an action (and not a deferred as DropPrevious for example)
     * because it's the MutexedDropPrevious role to trigger the RPC call that
     * returns a deferred when it's time.
     */
    MutexedDropPrevious: Class.extend({
        init: function () {
            console.log("start mutexed drop previous");

            this.currentDef = null;
            this.locked = false;
            this.pendingAction = null;
            this.pendingDef = null;
            this.i = 0;
        },
        /**
         * @param {function} action a function which may return a deferred
         * @returns {Deferred}
         */
        exec: function (action) {
            var self = this;
            var resolution, rejection;
            if (this.locked) {
                this.pendingAction = action;
                var oldPendingDef = this.pendingDef;

                this.pendingDef = new Promise(function (resolve, reject) {
                    resolution = resolve;
                    rejection = reject;
                    if (oldPendingDef) {
                        oldPendingDef.reject();
                    }
                    self.currentDef.reject();
                });
                this.pendingDef.resolve = resolution;
                this.pendingDef.reject = rejection;
                this.pendingDef.name = ++self.i;
                return this.pendingDef;
            } else {
                this.locked = true;
                this.currentDef = new Promise(function (resolve, reject) {
                    resolution = resolve;
                    rejection = reject;
                    Promise.resolve(action())
                        .then(function (result) {
                            resolve(result);
                            self.locked = false;
                            if (self.pendingAction) {
                                var action = self.pendingAction;
                                self.pendingAction = null;
                                self.exec(action)
                                    .then(self.pendingDef.resolve)
                                    .catch(self.pendingDef.reject);
                            }
                        })
                        .catch(function (result) {
                            reject(result);
                            self.locked = false;
                            if (self.pendingAction) {
                                var action = self.pendingAction;
                                self.pendingAction = null;
                                self.exec(action)
                                    .then(self.pendingDef.resolve)
                                    .catch(self.pendingDef.reject);
                            }
                        });
                });
                this.currentDef.resolve = resolution;
                this.currentDef.reject = rejection;
                self.i++;
                this.currentDef.name = self.i;
                return this.currentDef;
            }
        }
    }),
    /**
     * Rejects a promise as soon as a reference promise is either resolved or
     * rejected
     *
     * @param {Promise} [target_def] the promise to potentially reject
     * @param {Promise} [reference_def] the reference target
     * @returns {Promise}
     */
    rejectAfter: function (target_def, reference_def) {
        console.log("rejectAfter");
        return new Promise(function(resolve, reject) {
            target_def.then(resolve, reject);
            reference_def.then(reject, reject);
        });
    }
};

});
