/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { useActionLinks } from "@web/views/view_hook";
import { useService } from "@web/core/utils/hooks";

import { Component } from "@odoo/owl";

class AccountOnboardingWidget extends Component {
    static template = "account.Onboarding";
    static props = {
        ...standardWidgetProps,
    };
    setup() {
        this.action = useService("action");
        this._handleActionLinks = useActionLinks({});
        this.clickHandler = (event) => {
            this._handleActionLinks(event);
        };
    }

    get recordOnboardingSteps() {
        return JSON.parse(this.props.record.data.kanban_dashboard).onboarding?.steps;
    }
}

export const accountOnboarding = {
    component: AccountOnboardingWidget,
}

registry.category("view_widgets").add("account_onboarding", accountOnboarding);
