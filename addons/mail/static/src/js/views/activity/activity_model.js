odoo.define('mail.ActivityModel', function (require) {
'use strict';

var BasicModel = require('web.BasicModel');
var session = require('web.session');

var ActivityModel = BasicModel.extend({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
    * @override
    */
    get: function () {
        var list = this._super.apply(this, arguments);
        if (list && list.model === this.modelName) {
            if (list.type === 'record') {
                if (list.data && _.contains(_.map(this.additionalData.grouped_activities, function (act, key) { return Number(key) }), list.data.id)) {
                    list.data.activity_data = this.additionalData.grouped_activities[list.data.id];
                }
            } else {
                return _.extend(list, this.additionalData);
            }
        }
        return list;
    },
    /**
     * @override
     * @param {Object} params
     * @param {Array[]} params.domain
     * @returns {Deferred}
     */
    load: function (params) {
        var self = this;
        this.modelName = params.modelName;
        this.domain = params.domain;
        return this._super.apply(this, arguments).then(function (id) {
            return $.when(self._fetchData(id));
        });
    },
    /**
     * @param {any} handle
     * @param {Object} params
     * @param {Array[]} params.domain
     * @returns {Deferred}
     */
    reload: function (handle, params) {
        var self = this;
        if (params && 'domain' in params) {
            this.domain = params.domain;
        }
        return this._super.apply(this, arguments).then(function (id) {
            return self._fetchData(id);
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
    _fetchData: function (id) {
        var self = this;
        var def = this._rpc({
            model: "mail.activity",
            method: 'get_activity_data',
            kwargs: {
                res_model: this.modelName,
                domain: this.domain,
            }
        });
        return $.when(def).then(function (result) {
            self.additionalData = result;
            return id;
        });
    },
});

return ActivityModel;

});
