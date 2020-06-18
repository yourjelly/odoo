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
     * @param {Object} [params={}]
     * @param {Object} [params.fields]
     * @param {string} [params.modelName]
     * @param {boolean} [params.useSampleData=false]
     * @param {boolean} [params.isSampleModel=false]
     * @param {AbstractModel} [params.SampleModel]
     */
    init(parent, params = {}) {
        this._super(...arguments);
        this.useSampleData = params.useSampleData || false;
        if (this.useSampleData) {
            const sampleModelParams = Object.assign({}, params, {
                isSampleModel: true,
                SampleModel: null,
                useSampleData: false,
            });
            this.sampleModel = new params.SampleModel(this, sampleModelParams);
            this._isInSampleMode = false;
        }
        if (params.isSampleModel) {
            this.isSampleModel = true;
            this.sampleServer = new SampleServer(params.modelName, params.fields);
        }
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Override to call get on the sampleModel when we are in sample mode, and
     * option 'withSampleData' is set to true.
     *
     * @override
     * @param {any} _
     * @param {Object} [options]
     * @param {boolean} [options.withSampleData=false]
     */
    get(_, options) {
        let state;
        if (options && options.withSampleData && this._isInSampleMode) {
            state = this.sampleModel.__get(...arguments);
        } else {
            state = this.__get(...arguments);
        }
        return state;
    },
    /**
     * Under some conditions, the model is designed to generate sample data if
     * there is no real data in database. This function returns a boolean which
     * indicates the mode of the model: if true, we are in "sample" mode.
     *
     * @returns {boolean}
     */
    isInSampleMode() {
        return !!this._isInSampleMode;
    },
    /**
     * Disables the sample data (forever) on this model instance.
     */
    async leaveSampleMode() {
        if (this.useSampleData) {
            this.useSampleData = false;
            this._isInSampleMode = false;
            this.sampleModel.destroy();
        }
    },
    /**
     * @override
     */
    async load(params) {
        this.loadParams = params;
        let result = await this.__load(...arguments);
        await this._applySamples(result, '__load', arguments);
        return result;
    },
    /**
     * When something changes, the data may need to be refetched.  This is the
     * job for this method: reloading (only if necessary) all the data and
     * making sure that they are ready to be redisplayed.
     *
     * @param {any} _
     * @param {Object} [params={}]
     * @returns {Promise}
     */
    async reload(_, params) {
        if (this._isInSampleMode && this._haveParamsChanged(params)) {
            this.leaveSampleMode();
        }
        let result = await this.__reload(...arguments);
        await this._applySamples(result, '__reload', arguments);
        return result;
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
     * This function is called just after a load or a reload. If the sample data
     * feature is activated (useSampleData), it checks if the result is empty,
     * and if so, performs a new load (or reload), but on the sampleServer, to
     * get sample data instead of an empty state. The sample state will then be
     * accessible through get, by setting option 'withSampleData' to true.
     * Note that if result isn't empty, the sample data feature is deactivated.
     *
     * @private
     * @param {any} result the result of a load or a reload
     * @param {string} method '__load' or '__reload'
     * @param {any[]} args the args to pass to the specified method
     */
    async _applySamples(result, method, args) {
        if (this.useSampleData && this._isEmpty(result)) {
            if (method === '__load') {
                await this.sampleModel.__load(...args);
            } else {
                await this.sampleModel.__reload(...args);
            }
            this._isInSampleMode = true;
        } else {
            this.leaveSampleMode();
        }
    },
    /**
     * This function can be overriden to determine if the result of a load or
     * a reload is empty. In the affirmative, we will fallback on the sampleServer
     * to generate sample data, instead of an empty state.
     *
     * @private
     * @params {any} result, the value returned by a load or a reload
     * @returns {boolean}
     */
    _isEmpty(/* result */) {
        return false;
    },
    /**
     * To override to do the initial load of the data (this function is supposed
     * to be called only once).
     *
     * @private
     * @returns {Promise}
     */
    async __load() {
        return Promise.resolve();
    },
    /**
     * To override to reload data (this function may be called several times,
     * once the initial load has been done).
     *
     * @private
     * @returns {Promise}
     */
    async __reload() {
        return Promise.resolve();
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
     * Override to redirect all rpcs to the SampleServer if we are a SampleModel.
     *
     * @override
     */
    async _rpc() {
        if (this.isSampleModel) {
            return this.sampleServer.mockRpc(...arguments);
        }
        return this._super(...arguments);
    },
});

return AbstractModel;

});
