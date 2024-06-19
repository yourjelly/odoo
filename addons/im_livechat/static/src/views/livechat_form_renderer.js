import { Discuss } from "@mail/core/common/discuss";
import { FormRenderer } from "@web/views/form/form_renderer";

export class LivechatFormRenderer extends FormRenderer {
    static template = "livechat.LivechatDiscuss";
    static components = {
        ...FormRenderer.components,
        Discuss
    };
    // static props = {
    //     ...FormRenderer.props,
    //     initialApp: String,
    //     slots: Object,
    // };

    setup() {
        super.setup();
        // this.searchState = useState(this.env.searchState);
    }

    // get shouldAutoFocus() {
    //     return false;
    // }
}
