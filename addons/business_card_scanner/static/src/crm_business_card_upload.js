/** @odoo-module **/

import { registry } from "@web/core/registry"
import { useService } from "@web/core/utils/hooks";
import { listView } from "@web/views/list/list_view";
import { ListRenderer } from "@web/views/list/list_renderer";
import { ListController } from "@web/views/list/list_controller";
import { FileUploader } from "@web/views/fields/file_handler";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";

import { Component, useState } from "@odoo/owl";

export class CrmBusinessCardUploader extends Component {
    static template = "business_card_scanner.CrmBusinessCardUploader";
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
            "crm.lead",
            "create_crm_lead_from_attachment",
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

export class CrmUploadListController extends ListController {
    static components = {
        ...ListController.components,
        CrmBusinessCardUploader,
    };
};

export const CrmUploadListView = {
    ...listView,
    Controller: CrmUploadListController,
    Renderer: ListRenderer,
    buttonTemplate: "business_card_scanner.crm.ListView.Buttons",
};

registry.category("views").add("crm_upload_tree", CrmUploadListView);
