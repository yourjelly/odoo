import { patch } from "@web/core/utils/patch";
import { SignRequestCogMenuItem } from "@sign/backend_components/cog_menu/sign_request_cog_menu";

patch(SignRequestCogMenuItem, {
    isDisplayed(props) {
        return super.isDisplayed(props) && !(props.config.actionName === 'To-dos');
    },
});
