/** @odoo-module */

import BasicModel from 'web.BasicModel';

const KnowledgeFormModel = BasicModel.extend({
    /**
     * @returns Array[String]
     */
    getSupportedModifiers: function () {
        return [...this._super(), 'full_width'];
    }
});

export {
    KnowledgeFormModel,
};
