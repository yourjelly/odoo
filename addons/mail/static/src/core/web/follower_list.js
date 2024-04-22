import { Component, useState, onWillUnmount, onWillStart } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { FollowerSubtypeDialog } from "./follower_subtype_dialog";
import { useVisible } from "@mail/utils/common/hooks";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";

/**
 * @typedef {Object} Props
 * @property {function} [onAddFollowers]
 * @property {function} [onFollowerChanged]
 * @property {import('@mail/core/common/thread_model').Thread} thread
 * @extends {Component<Props, Env>}
 */

let local_id = 0;

export class FollowerList extends Component {
    static template = "mail.FollowerList";
    static components = { DropdownItem };
    static props = ["onAddFollowers?", "onFollowerChanged?", "thread", "dropdown"];

    setup() {
        super.setup();
        this.action = useService("action");
        this.store = useState(useService("mail.store"));
        this.followerListId = local_id++;
        useVisible("load-more", (isVisible) => {
            if (isVisible) {
                this.followerListView.loadMoreFollowers();
            }
        });

        onWillStart(async () => {
            await this.store.FollowerListView.insert({
                id: this.followerListId,
                thread_id: this.props.thread.id,
                thread_model: this.props.thread.model,
            });
            await this.followerListView.get_follower();
        });

        onWillUnmount(() => {
            this.followerListView?.delete();
        });
    }

    get followerListView() {
        return this.store.FollowerListView.get({ id: this.followerListId });
    }

    onClickAddFollowers() {
        const action = {
            type: "ir.actions.act_window",
            res_model: "mail.wizard.invite",
            view_mode: "form",
            views: [[false, "form"]],
            name: _t("Add followers to this document"),
            target: "new",
            context: {
                default_res_model: this.props.thread.model,
                default_res_id: this.props.thread.id,
                dialog_size: "medium",
            },
        };
        this.action.doAction(action, {
            onClose: () => {
                this.props.onAddFollowers?.();
            },
        });
    }

    /**
     * @param {MouseEvent} ev
     * @param {import("models").Follower} follower
     */
    onClickDetails(ev, follower) {
        this.store.openDocument({ id: follower.partner.id, model: "res.partner" });
        this.props.dropdown.close();
    }

    /**
     * @param {MouseEvent} ev
     * @param {import("models").Follower} follower
     */
    async onClickEdit(ev, follower) {
        this.env.services.dialog.add(FollowerSubtypeDialog, {
            follower,
            onFollowerChanged: () => this.props.onFollowerChanged?.(this.props.thread),
        });
        this.props.dropdown.close();
    }

    /**
     * @param {MouseEvent} ev
     * @param {import("models").Follower} follower
     */
    async onClickRemove(ev, follower) {
        const thread = this.props.thread;
        await follower.remove();
        this.props.onFollowerChanged?.(thread);
    }
}
