odoo.define('web.SortedRegistry', function (require) {
"use strict";

var Registry = require('web.Registry');

/**
 * A sorted registry is a registry in whick items are sorted.
 */
var SortedRegistry = Registry.extend({
    /**
     * @constructor
     * @param {Object} [mapping] the initial data in the registry
     */
    init: function () {
        var self = this;
        this._super.apply(this, arguments);
        this._scores = [];
        this._initialKeys = Object.keys(this.map);
        this._sortedKeys = this._initialKeys;
        this.listeners.push(function () {
            self.sortedKeys = self._initialKeys.concat(
                _.sortBy(self._scores, 'score').map(function (score) {
                    return score.key;
                })
            );
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * overide
     *
     *  Allows to attribute a score to the added key. This can be used to sort keys
     *  using the scores.
     *
     * @param {string} key
     * @param {any} value
     * @param {number} score
     * @returns {Registry} can be used to chain add calls.
     */
    add: function (key, value, score) {
        this._scores.push({
            key: key,
            score: score || key,
        });
        this._super.apply(this, arguments);
    },
    /**
     * @overide
     * returns the object map keys sorted according to this.sortFunction
     * returns {string[]}
     */
    keys: function () {
        return this.sortedKeys;
    },

});

return SortedRegistry;

});