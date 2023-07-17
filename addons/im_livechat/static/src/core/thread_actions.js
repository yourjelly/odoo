/* @odoo-module */

import { threadActionsRegistry } from "@mail/core/common/thread_actions";
import "@mail/discuss/core/common/thread_actions";

const memberListAction = threadActionsRegistry.get("member-list");
threadActionsRegistry.add(
    "member-list",
    {
        ...memberListAction,
        componentProps(action, component) {
            const originalProps = memberListAction.componentProps?.(action, component) ?? {};
            const openChannelInvitePanel = (keepPrevious) =>
                component.threadActions.actions
                    .find(({ id }) => id === "add-users")
                    ?.open(keepPrevious);
            return {
                ...originalProps,
                openChannelInvitePanel,
            };
        },
    },
    { force: true }
);
