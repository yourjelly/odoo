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
 * Container for messaging component ListFieldActivityView ensuring messaging
 * records are ready before rendering ListFieldActivityView component.
 */
export class ListFieldActivityViewContainer extends Component {
    /**
     * @override
     */
    setup() {
        super.setup();
        useMessagingContainer();
        this.listFieldActivityView = undefined;
        this.listFieldActivityViewId = getNextId();
        this._insertFromProps(this.props);
        onWillUpdateProps((nextProps) => this._insertFromProps(nextProps));
        onWillDestroy(() => this._deleteRecord());
    }

    /**
     * @private
     */
    _deleteRecord() {
        if (this.listFieldActivityView) {
            if (this.listFieldActivityView.exists()) {
                this.listFieldActivityView.delete();
            }
            this.listFieldActivityView = undefined;
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
        const listFieldActivityView = messaging.models["ListFieldActivityView"].insert({
            id: this.listFieldActivityViewId,
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
        if (listFieldActivityView !== this.listFieldActivityView) {
            this._deleteRecord();
            this.listFieldActivityView = listFieldActivityView;
        }
        this.render();
    }
}

Object.assign(ListFieldActivityViewContainer, {
    props: {
        ...standardFieldProps,
    },
    template: "mail.ListFieldActivityViewContainer",
});

export const listFieldActivityViewContainer = {
    component: ListFieldActivityViewContainer,
    fieldDependencies: [
        { name: "activity_exception_decoration", type: "selection" },
        { name: "activity_exception_icon", type: "char" },
        { name: "activity_state", type: "selection" },
        { name: "activity_summary", type: "char" },
        { name: "activity_type_icon", type: "char" },
        { name: "activity_type_id", type: "many2one", relation: "mail.activity.type" },
    ],
};
