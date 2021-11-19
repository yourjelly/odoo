/** @odoo-module **/

import core from "web.core";
import FormEditorRegistry from "website.form_editor_registry";

let _t = core._t;

FormEditorRegistry.add('create_mailing_contact_subscription', {
    formFields: [{
        type: 'char',
        required: true,
        name: 'contact_name',
        string: _t('Your Name'),
    }, {
        type: 'email',
        name: 'contact_email',
        string: _t('Your Email'),
    }],
    fields: [{
        name: 'list_id',
        type: 'many2one',
        relation: 'mailing.list',
        required: true,
        string: _t('Mailing List'),
        title: _t('Assign a contact to a mailing list.'),
    }],
    successPage: '/subscription-submitted',
});
