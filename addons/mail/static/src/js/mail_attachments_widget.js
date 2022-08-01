/** @odoo-module **/
"use strict";

import AbstractFieldOwl from 'web.AbstractFieldOwl';
import field_registry from 'web.field_registry_owl';


export class MailAttachmentsWidget extends AbstractFieldOwl{

    getRenderValues(){
        return this.record.data.attachments_widget;
    }

}

MailAttachmentsWidget.template = "mail.mail_attachments_widget";

field_registry.add("mail_attachments_widget", MailAttachmentsWidget);
