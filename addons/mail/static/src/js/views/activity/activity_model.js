odoo.define('mail.ActivityModel', function (require) {
'use strict';

var BasicModel = require('web.BasicModel');
var session = require('web.session');

var ActivityModel = BasicModel.extend({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Add the following (activity specific) keys when performing a `get`
     *
     * - activity_types
     * - activity_res_ids
     * - grouped_activities
     *
     * @override
     * @returns {Object}
     */
    get: function () {
        var list = this._super.apply(this, arguments);
        if (list && list.model === this.modelName && list.type === 'list') {
            return _.extend(list, this.additionalData);
        }
        return list;
    },
    /**
     * @override
     * @param {Object} params
     * @returns {Deferred<string>} resolves to a local id or handle
     */
    load: function (params) {
        var self = this;
        this.modelName = params.modelName;
        this.domain = params.domain;
        var def = this._super.apply(this, arguments);
        return $.when(def, this._fetchData()).then(function (recordID) {
            return recordID;
        });
    },
    /**
     * @override
     * @param {any} handle
     * @param {Object} params
     * @param {Array[]} params.domain
     * @returns {Deferred<string>} resolves to a local id or handle
     */
    reload: function (handle, params) {
        var self = this;
        if (params && 'domain' in params) {
            this.domain = params.domain;
        }
        var def = this._super.apply(this, arguments);
        return $.when(def, this._fetchData()).then(function (recordID) {
            return recordID;
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Fetch activity data.
     *
     * @private
     * @returns {Deferred}
     */
    _fetchData: function () {
        var self = this;
        return this._rpc({
            model: "mail.activity",
            method: 'get_activity_data',
            kwargs: {
                res_model: this.modelName,
                domain: this.domain,
            }
        }).then(function (result) {
            self.additionalData = result;
        });
    },
});

return ActivityModel;

});
