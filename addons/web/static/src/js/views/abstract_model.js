odoo.define('web.AbstractModel', function (require) {
"use strict";

/**
 * An AbstractModel is the M in MVC.  We tend to think of MVC more on the server
 * side, but we are talking here on the web client side.
 *
 * The duties of the Model are to fetch all relevant data, and to make them
 * available for the rest of the view.  Also, every modification to that data
 * should pass through the model.
 *
 * Note that the model is not a widget, it does not need to be rendered or
 * appended to the dom.  However, it inherits from the EventDispatcherMixin,
 * in order to be able to notify its parent by bubbling events up.
 */

var fieldUtils = require('web.field_utils');
var mvc = require('web.mvc');
const SampleServer = require('web.SampleServer');


var AbstractModel = mvc.Model.extend({
    /**
     * @param {Widget} parent
     * @param {Object} params
     * @param {Object} param.fields
     * @param {string} param.modelName
     * @param {boolean} [params.useSampleData=false]
     */
    init(parent, params) {
        this._super(...arguments);
        params = params || {};
        this.useSampleData = params.useSampleData || false;
        this.isSample = false;
        if (this.useSampleData) {
            this.sampleServer = new SampleServer(params.modelName, params.fields);
        }
        window.model = this;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get(handle, options) {
        options = options || {};
        const state = this._get(...arguments);
        if (state && state.isSample && !options.withSampleData) {
            return this._cleanState(state);
        }
        return state;
    },
    /**
     * @override
     */
    load(params) {
        this.loadParams = params;
        return this._super(...arguments);
    },
    /**
     * When something changes, the data may need to be refetched.  This is the
     * job for this method: reloading (only if necessary) all the data and
     * making sure that they are ready to be redisplayed.
     *
     * @param {any} handle
     * @param {Object} [params={}]
     * @returns {Promise}
     */
    reload: function (handle, params) {
        this.isSample = false;
        if (this.useSampleData) {
            this.useSampleData = !this._haveParamsChanged(params);
        }
        return Promise.resolve();
    },
    /**
     * Processes date(time) and selection field values sent by the server.
     * Converts data(time) values to moment instances.
     * Converts false values of selection fields to 0 if 0 is a valid key,
     * because the server doesn't make a distinction between false and 0, and
     * always sends false when value is 0.
     *
     * @param {Object} field the field description
     * @param {*} value
     * @returns {*} the processed value
     */
    _parseServerValue: function (field, value) {
        if (field.type === 'date' || field.type === 'datetime') {
            // process date(time): convert into a moment instance
            value = fieldUtils.parse[field.type](value, field, {isUTC: true});
        } else if (field.type === 'selection' && value === false) {
            // process selection: convert false to 0, if 0 is a valid key
            var hasKey0 = _.find(field.selection, function (option) {
                return option[0] === 0;
            });
            value = hasKey0 ? 0 : value;
        }
        return value;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} state
     * @returns {Object}
     */
    _cleanState(state) {
        return state;
    },

    /**
     * @private
     * @param {any} handle
     * @param {boolean} mustReload
     * @returns {Promise}
     */
    async _forgetSampleData(handle, mustReload) {
        if (this.useSampleData) {
            this.useSampleData = false;
            if (mustReload) {
                await this.reload(handle);
            }
        }
    },

    /**
     * @private
     * @returns {Object}
     */
    _get() {
        return {};
    },

    /**
     * Determines whether or not the given params differ from the initial ones
     * (this.loadParams). This is used to deactivate the sample data feature as
     * soon as a parameter (e.g. domain) changes.
     *
     * @private
     * @param {Object} params
     * @returns {boolean}
     */
    _haveParamsChanged(params) {
        for (const key of ['context', 'domain', 'timeRanges']) {
            if (key in params) {
                const diff = JSON.stringify(params[key]) !== JSON.stringify(this.loadParams[key]);
                if (diff) {
                    return true;
                }
            }
        }
        if (this.useSampleData && 'groupBy' in params) {
            return JSON.stringify(params.groupBy) !== JSON.stringify(this.loadParams.groupedBy);
        }
    },

    /**
     * Override to invoke the SampleServer when necessary, to populate the
     * result with fake data.
     *
     * @private
     * @override
     */
    async _rpc(params) {
        let result = await this._super(...arguments);
        if (this.useSampleData) {
            if (this.sampleServer.canMock(params)) {
                if (this.isSample || this.sampleServer.isEmpty(params, result)) {
                    this.isSample = true;
                    result = await this.sampleServer.mockRpc(params, result);
                } else {
                    this.useSampleData = false;
                }
            }
        }
        return result;
    },
});

return AbstractModel;

});
