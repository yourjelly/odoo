import { FEATURES } from "@im_livechat/embed/common/features";
import { SESSION_STATE } from "@im_livechat/embed/common/livechat_service";
import { feature } from "@mail/core/common/features";

import { threadActionsRegistry } from "@mail/core/common/thread_actions";
import "@mail/discuss/call/common/thread_actions";
import { useComponent } from "@odoo/owl";

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

const callSettingsAction = threadActionsRegistry.get("settings");
feature(FEATURES.EMBED_LIVECHAT)
    .registerIIFE(() => {
        threadActionsRegistry.add("restart", {
            condition(component) {
                return component.chatbotService.canRestart;
            },
            icon: "fa fa-fw fa-refresh",
            name: _t("Restart Conversation"),
            open(component) {
                component.chatbotService.restart();
                component.chatWindowService.show(component.props.chatWindow);
            },
            sequence: 99,
        });
    })
    .registerPatch(callSettingsAction, {
        condition(component) {
            if (component.thread?.type !== "livechat") {
                return super.condition(...arguments);
            }
            return (
                component.livechatService.state === SESSION_STATE.PERSISTED &&
                component.rtcService.state.channel?.eq(component.thread)
            );
        },
        setup() {
            super.setup(...arguments);
            const component = useComponent();
            component.livechatService = useService("im_livechat.livechat");
            component.rtcService = useService("discuss.rtc");
        },
    });
