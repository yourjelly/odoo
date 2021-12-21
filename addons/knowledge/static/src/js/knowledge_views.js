/** @odoo-module */

import FormView from 'web.FormView';
import viewRegistry from 'web.view_registry';
import { KnowledgeFormRenderer } from './knowledge_renderers.js';

const KnowledgeFormView = FormView.extend({
    config: _.extend({}, FormView.prototype.config, {
        Renderer: KnowledgeFormRenderer,
    }),
});

viewRegistry.add('knowledge_view_form', KnowledgeFormView);

export {
    KnowledgeFormView,
};
