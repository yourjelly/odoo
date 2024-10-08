/** @odoo-module **/

import { registry } from "@web/core/registry"
import { useService } from "@web/core/utils/hooks";
import { listView } from "@web/views/list/list_view";
import { ListRenderer } from "@web/views/list/list_renderer";
import { ListController } from "@web/views/list/list_controller";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { KanbanController } from "@web/views/kanban/kanban_controller";
import { FileUploader } from "@web/views/fields/file_handler";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";

import { Component } from "@odoo/owl";

export class ContactBusinessCardUploader extends Component {
    static template = "business_card_scanner.ContactBusinessCardUploader";
    static components = {
        FileUploader,
    };
    static props = {
        ...standardWidgetProps,
        record: { type: Object, optional: true },
        togglerTemplate: { type: String, optional: true },
        btnClass: { type: String, optional: true },
        divClass: { type: String, optional: true },
        linkText: { type: String, optional: true },
        slots: { type: Object, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.attachmentIdsToProcess = [];
    }

    async onFileUploaded(file) {
        const att_data = {
            name: file.name,
            mimetype: file.type,
            datas: file.data,
        };
        const [att_id] = await this.orm.create("ir.attachment", [att_data], {
            context: { ...this.env.searchModel.context },
        });
        this.attachmentIdsToProcess.push(att_id);
    }

    async onUploadComplete() {
        const action = await this.orm.call(
            "res.partner",
            "create_contact_from_attachment",
            ["", this.attachmentIdsToProcess],
            {
                context: { ...this.env.searchModel.context },
            }
        );
        this.attachmentIdsToProcess = [];
        if (action.context && action.context.notifications) {
            for (let [file, msg] of Object.entries(action.context.notifications)) {
                this.notification.add(
                    msg,
                    {
                        title: file,
                        type: "info",
                        sticky: true,
                    });
            }
            delete action.context.notifications;
        }
        this.action.doAction(action);
    }

    get divClass() {
        return this.props.divClass || 
            (this.props.record && this.props.record.data ? 
            'oe_kanban_color_' + this.props.record.data.color : 
            '');
    }
}

export class ContactsUploadListController extends ListController {
    static components = {
        ...ListController.components,
        ContactBusinessCardUploader,
    };
};

export const ContactsUploadListView = {
    ...listView,
    Controller: ContactsUploadListController,
    Renderer: ListRenderer,
    buttonTemplate: "business_card_scanner.contact.ListView.Buttons",
};

export class ContactsUploadKanbanController extends KanbanController {
    static components = {
        ...KanbanController.components,
        ContactBusinessCardUploader,
    };
}

export const ContactsUploadKanbanView = {
    ...kanbanView,
    Controller: ContactsUploadKanbanController,
    Renderer: KanbanRenderer,
    buttonTemplate: "business_card_scanner.contact.KanbanView.Buttons",
};

registry.category("views").add("contacts_upload_tree", ContactsUploadListView);
registry.category("views").add("contacts_upload_kanban", ContactsUploadKanbanView);
