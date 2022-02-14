/** @odoo-module */

import BasicModel from 'web.BasicModel';

const KnowledgeFormModel = BasicModel.extend({
    /**
     * @override
     * @param {Object} dataPoint
     * @param {Object} options
     * @returns {Promise}
     */
    _load: function (dataPoint, options) {
        return this._super(...arguments).catch(() => {
            // In `basic_model.js`, the `_load` returns a promise that will load
            // all data required to render the view.
            // When the `_fetchRecord` function is called, the function will issue
            // an rpc call to load the record from the database. When the record
            // with the given id doesn't exist, the server response will be empty
            // and the promise returned by `_fetchRecord` will be rejected.
            // Currently, there is not handler to catch the promise rejection. As
            // a result, the view will throw an error in the console.
            // To display an error message will just ignore the promise rejection.
            // Then, we will overwrite the `_renderView` function from the controler
            // to render an error page when the state is empty.
        });
    },
});

export {
    KnowledgeFormModel,
};
