/** @odoo-module */
import { Component, useState, useRef, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardWidgetProps } from '@web/views/widgets/standard_widget_props';
import { Chatter } from '@mail/chatter/web_portal/chatter';
import { useService } from "@web/core/utils/hooks";
import { user } from "@web/core/user";
import { SIZES } from "@web/core/ui/ui_service";


export class TodoChatter extends Component {
    static template = "project_todo.TodoChatter";
    static components = { Chatter };
    static props = {
        ...standardWidgetProps,
    };
    setup() {
        this.state = useState({
            displayChatter: false,
        });
        this.root = useRef('root')
        this.ui = useService("ui");

        this.env.bus.addEventListener('TODO:TOGGLE_CHATTER', this.toggleChatter.bind(this));
    }

    toggleChatter(event) {
        this.state.displayChatter = event.detail.displayChatter;
        if (this.state.displayChatter) {
            this.root.el?.parentElement?.classList.remove('d-none');
        } else {
            this.root.el?.parentElement?.classList.add('d-none');
        }
    }

    get isChatterAside() {
        return this.ui.size >= SIZES.LG;
    }
}


export const todoChatter = {
    component: TodoChatter,
    additionalClasses: [
        'o_todo_chatter',
        'position-relative',
        'p-0',
    ]
}

registry.category("view_widgets").add("todo_chatter_panel", todoChatter);


export class TodoChatterPanel extends Component {
    static template = "project_todo.TodoChatterPanel";
    static components = { Chatter, TodoChatter };

    static props = {
        ...standardWidgetProps,
    };
    setup() {
        this.state = useState({
            displayChatter: false,
        });

        this.root = useRef('root')
        this.ui = useService("ui");

        onWillStart(async () => {
            this.isInternalUser = await user.hasGroup('base.group_user');
        });
    }

    toggleChatter(event) {
        if (this.props.record.resId) {
            this.state.displayChatter = !this.state.displayChatter;
            this.env.bus.trigger('TODO:TOGGLE_CHATTER', {displayChatter: this.state.displayChatter});
        }
    }
}
