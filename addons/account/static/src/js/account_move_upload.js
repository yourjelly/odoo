/** @odoo-module **/

import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { FileUploader } from "@web/fields/file_handler";

const { useState } = owl;

//is this the best way to define a mixin to be use in Both Controllers below??
//what about the setup method?? extracting Object.assign() to outside the class doesn't seem to work ??
let AccountMoveUploadMixin = {
    async onFileUploaded(files) {
        this.state.file_count += 1;
    },

    onUploadComplete() {
        console.log(this.state.file_count);
    }
}

class AccountMoveUploadListController extends listView.Controller {
    setup() {
        super.setup();
        this.state = useState({
            file_count: 0,
        });
        Object.assign(this, AccountMoveUploadMixin);
    }
}
AccountMoveUploadListController.components.FileUploader = FileUploader;

const AccountMoveUploadListView = {
    ...listView,
    Controller: AccountMoveUploadListController,
    buttonTemplate: "account.ListView.Buttons",
};

class AccountMoveUploadKanbanController extends kanbanView.Controller {
    setup() {
        super.setup();
        this.state = useState({
            file_count: 0,
        });
        Object.assign(this, AccountMoveUploadMixin);
    }
}
AccountMoveUploadKanbanController.components.FileUploader = FileUploader;

const AccountMoveUploadKanbanView = {
    ...kanbanView,
    Controller: AccountMoveUploadKanbanController,
    buttonTemplate: "account.KanbanView.Buttons",
};

registry.category("views").add("account_tree", AccountMoveUploadListView);
registry.category("views").add("account_bills_kanban", AccountMoveUploadKanbanView);
