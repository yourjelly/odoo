/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import FormEditorRegistry from "@website/js/form_editor_registry";

FormEditorRegistry.add('create_task', {
    formFields: [{
        type: 'char',
        modelRequired: true,
        name: 'name',
        string: _t('Task Title'),
    }, {
        type: 'char',
        modelRequired: true,
        fillWith: 'name', 
        name: 'your_name', 
        string: _t('Your Name'),
    },{
        type: 'char',
        fillWith: 'phone', 
        name: 'phone_number',  
        string: _t('Your Phone Number'),
    },{
        type: 'email',
        custom: true,
        required: true,
        fillWith: 'email',
        name: 'email_from',
        string: _t('Your Email'),
    },{
        type: 'char',
        fillWith: 'company_name',
        name: 'company_name', 
        string: _t('Company Name'),
    }, {
        type: 'char',
        name: 'description',
        string: _t('Description'),
    },{
        type: 'char',
        name: 'ask_question', 
        string: _t('Ask Your Question'),
    },],
    fields: [{
        name: 'project_id',
        type: 'many2one',
        relation: 'project.project',
        string: _t('Project'),
        createAction: 'project.open_view_project_all',
    }],
});
