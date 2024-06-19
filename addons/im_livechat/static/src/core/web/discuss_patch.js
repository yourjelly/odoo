import { Discuss } from "@mail/core/common/discuss";
// import { DiscussSidebar } from "@mail/core/web/discuss_sidebar";
import { MessagingMenu } from "@mail/core/web/messaging_menu";

import { ControlPanel } from "@web/search/control_panel/control_panel";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { usePager } from "@web/search/pager_hook";
import { DiscussChannelListController } from "@im_livechat/views/discuss_channel_list/discuss_channel_list_view_controller";
import { actionService } from "@web/webclient/actions/action_service";
import { useService } from "@web/core/utils/hooks";

Object.assign(Discuss.components, { ControlPanel, MessagingMenu });

patch(Discuss.prototype, {
    setup() {
        this.actionService = useService("action");
        // this.model = useState(useModel(this.props.Model, this.modelParams));
        super.setup();
        // debugger
        // onRendered(() => {
        //     if (this.thread?.displayName) {
        //         this.env.config?.setDisplayName(this.thread.displayName);
        //     }
        // });
        // usePager(() => {
        //     debugger;
        //     // const { count, hasLimitedCount, limit, offset } = this.model.root;
        //     return {
        //         offset: 1,
        //         limit: 1,
        //         total: 20,
        //         onUpdate: (newState) => {
        //             return this.actionService.doAction("mail.action_discuss", {
        //                 name: _t("Discuss"),
        //                 additionalContext: { active_id: 16 },
        //             });
        //             // p++;
        //         },
        //     };
        // });
    },
});
