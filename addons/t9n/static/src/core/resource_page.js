import { useState, Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { MessageForm } from "@t9n/core/message_form";

export class ResourcePage extends Component {
    static props = {};
    static components = { MessageForm };
    static template = "t9n.ResourcePage";

    setup() {
        this.state = useState({
            isLoading: true,
        });
        this.store = useState(useService("t9n.store"));
        this.orm = useService("orm");
        this.store.fetchResource().then(() => {
            this.state.isLoading = false;
        });
    }

    get messages() {
        return this.store.resource.messages;
    }

    onClickMessage(message) {
        this.store.setActiveMessage(message);
    }
}
