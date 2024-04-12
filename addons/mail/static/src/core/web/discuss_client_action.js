import { Discuss } from "@mail/core/common/discuss";

import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

/**
 * @typedef {Object} Props
 * @property {Object} action
 * @property {Object} action.context
 * @property {number} [action.context.active_id]
 * @property {Object} [action.params]
 * @property {number} [action.params.active_id]
 * @extends {Component<Props, Env>}
 */
export class DiscussClientAction extends Component {
    static components = { Discuss };
    static props = ["*"];
    static template = "mail.DiscussClientAction";

    setup() {
        super.setup();
        this.store = useState(useService("mail.store"));
        this.messaging = useState(useService("mail.messaging"));
        this.threadService = useService("mail.thread");
        onWillStart(() => {
            // bracket to avoid blocking rendering with restore promise
            this.restoreDiscussThread(this.props);
        });
        onWillUpdateProps((nextProps) => {
            // bracket to avoid blocking rendering with restore promise
            this.restoreDiscussThread(nextProps);
        });
    }

    /**
     * Restore the discuss thread according to the active_id in the action if
     * necessary.
     *
     * @param {Props} props
     */
    async restoreDiscussThread(props) {
        const { context, params } = props.action;
        const resId = context.resId || params.resId;
        const id =
            resId ??
            props.action.active_id ??
            this.store.discuss.thread?.id ??
            this.store.discuss.inbox.localId;
        const model = resId
            ? "mail.box"
            : props.action.active_id
            ? "discuss.channel"
            : this.store.discuss.thread?.model ?? "mail.box";
        const activeThread = await this.store.Thread.getOrFetch({ model, id });
        if (activeThread && activeThread.notEq(this.store.discuss.thread)) {
            this.threadService.setDiscussThread(activeThread, false);
        }
        // let model = this.store.discuss.thread?.model ??
        // console.warn(props);
        // let id =
        //     props.action.context.active_id ??
        //     props.action.params?.active_id;
        //     // this.store.discuss.thread?.localId ??
        //     // this.store.discuss.inbox.id;
        // const model = id < 0 ? "mail.box" : "discuss.channel";
        // const activeThread = await this.store.Thread.getOrFetch({ model, id });
        // if (activeThread && activeThread.notEq(this.store.discuss.thread)) {
        //     this.threadService.setDiscussThread(activeThread, false);
        // }
        this.store.discuss.hasRestoredThread = true;
    }
}

registry.category("actions").add("mail.action_discuss", DiscussClientAction);
