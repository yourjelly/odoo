/** @odoo-module **/

// ensure components are registered beforehand.
import { useMessagingContainer } from "@mail/component_hooks/use_messaging_container";

import { standardFieldProps } from "@web/views/fields/standard_field_props";

import { Component, onWillDestroy, onWillUpdateProps } from "@odoo/owl";

const getNextId = (function () {
    let tmpId = 0;
    return () => {
        tmpId += 1;
        return tmpId;
    };
})();

/**
 * Container for messaging component KanbanFieldActivityView ensuring messaging
 * records are ready before rendering KanbanFieldActivityView component.
 */
export class KanbanFieldActivityViewContainer extends Component {
    /**
     * @override
     */
    setup() {
        super.setup();
        useMessagingContainer();
        this.kanbanFieldActivityView = undefined;
        this.kanbanFieldActivityViewId = getNextId();
        this._insertFromProps(this.props);
        onWillUpdateProps((nextProps) => this._insertFromProps(nextProps));
        onWillDestroy(() => this._deleteRecord());
    }

    /**
     * @private
     */
    _deleteRecord() {
        if (this.kanbanFieldActivityView) {
            if (this.kanbanFieldActivityView.exists()) {
                this.kanbanFieldActivityView.delete();
            }
            this.kanbanFieldActivityView = undefined;
        }
    }

    /**
     * @private
     */
    async _insertFromProps(props) {
        const messaging = await this.env.services.messaging.get();
        if (owl.status(this) === "destroyed") {
            this._deleteRecord();
            return;
        }
        const kanbanFieldActivityView = messaging.models["KanbanFieldActivityView"].insert({
            id: this.kanbanFieldActivityViewId,
            thread: {
                activities: props.value.records.map((activityData) => {
                    return {
                        id: activityData.resId,
                    };
                }),
                hasActivities: true,
                id: props.record.resId,
                model: props.record.resModel,
            },
            webRecord: props.record,
        });
        if (kanbanFieldActivityView !== this.kanbanFieldActivityView) {
            this._deleteRecord();
            this.kanbanFieldActivityView = kanbanFieldActivityView;
        }
        this.render();
    }
}

Object.assign(KanbanFieldActivityViewContainer, {
    props: {
        ...standardFieldProps,
    },
    template: "mail.KanbanFieldActivityViewContainer",
});

export const kanbanFieldActivityViewContainer = {
    component: KanbanFieldActivityViewContainer,
    fieldDependencies: [
        { name: "activity_exception_decoration", type: "selection" },
        { name: "activity_exception_icon", type: "char" },
        { name: "activity_state", type: "selection" },
        { name: "activity_summary", type: "char" },
        { name: "activity_type_icon", type: "char" },
        { name: "activity_type_id", type: "many2one", relation: "mail.activity.type" },
    ],
};
