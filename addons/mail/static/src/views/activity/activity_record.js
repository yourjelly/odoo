/** @odoo-module */

import { ActivityCompiler } from "./activity_compiler";
import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { Field } from "@web/views/fields/field";
import {
    getImageSrcFromRecordInfo,
    isHtmlEmpty,
} from "@web/views/kanban/kanban_record";
import { useViewCompiler } from "@web/views/view_compiler";

export class ActivityRecord extends Component {
    setup() {
        this.user = useService("user");
        this.widget = {
            deletable: false,
            editable: false,
            isHtmlEmpty,
        };
        const { arch, templateDocs } = this.props.archInfo;
        const compileParams = {
            recordExpr: `record`,
        };
        this.recordTemplate = useViewCompiler(ActivityCompiler, arch, templateDocs, compileParams)[
            "activity-box"
        ];
    }

    getRenderingContext() {
        const { record } = this.props;
        console.log(this.props.record)
        return {
            record: record.formattedRecord,
            activity_image: (...args) => getImageSrcFromRecordInfo(record, ...args),
            user_context: this.user.context,
            widget: this.widget,
        };
    }
}

ActivityRecord.components = {
    Field,
};
ActivityRecord.props = {
    archInfo: { type: Object },
    openRecord: { type: Function },
    record: { type: Object },
};
ActivityRecord.template = "mail.ActivityRecord";
