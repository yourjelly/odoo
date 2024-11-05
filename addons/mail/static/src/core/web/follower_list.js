import { Component, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { FollowerSubtypeDialog } from "./follower_subtype_dialog";
import { useVisible } from "@mail/utils/common/hooks";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";

/**
 * @typedef {Object} Props
 * @property {function} [onEditFollowers]
 * @property {function} [onFollowerChanged]
 * @property {import('@mail/core/common/thread_model').Thread} thread
 * @extends {Component<Props, Env>}
 */

export class FollowerList extends Component {
    static template = "mail.FollowerList";
    static components = { DropdownItem };
    static props = ["onEditFollowers?", "onFollowerChanged?", "thread", "dropdown"];

    setup() {
        super.setup();
        this.action = useService("action");
        this.store = useState(useService("mail.store"));
        useVisible("load-more", (isVisible) => {
            if (isVisible) {
                this.props.thread.loadMoreFollowers();
            }
        });
    }

    onClickEditFollowers() {
        const action = {
            type: "ir.actions.act_window",
            res_model: "mail.followers.edit",
            view_mode: "form",
            views: [[false, "form"]],
            name: _t("Edit followers of this document"),
            target: "new",
            context: {
                default_res_model: this.props.thread.model,
                default_res_ids: [this.props.thread.id],
                dialog_size: "medium",
            },
        };
        this.action.doAction(action, {
            onClose: () => {
                this.props.onEditFollowers?.();
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
