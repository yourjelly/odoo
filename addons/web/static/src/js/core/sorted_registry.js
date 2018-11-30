odoo.define('web.SortedRegistry', function (require) {
"use strict";

var Registry = require('web.Registry');

/**
 * A sorted registry is a registry in which items are sorted.
 */
var SortedRegistry = Registry.extend({
    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this._scoreMapping = Object.create(null);
        this._sortedKeys = null;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     *
     * Allows to attribute a score to the added key. This can be used to sort
     * keys using the scores.
     *
     * @param {string} key
     * @param {any} value
     * @param {[number]} score
     * @returns {Registry} can be used to chain add calls.
     */
    add: function (key, value, score) {
        this._scoreMapping[key] = score === undefined ? key : score;
        this._sortedKeys = null;
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     *
     * @returns {string[]} sorted keys, according to their scores
     */
    keys: function () {
        var self = this;
        if (!this._sortedKeys) {
            this._sortedKeys = _.sortBy(this._super(), function (key) {
                return self._scoreMapping[key] || 0;
            });
        }
        return this._sortedKeys;
    },

});

return SortedRegistry;

});