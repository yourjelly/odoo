import {
    onWillStart,
    useState,
} from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { usePopover } from "@web/core/popover/popover_hook";
import { AccountTaxPopup } from "./account_tax_info_popup";
import { Many2ManyTaxTagsField } from "../many2many_tax_tags/many2many_tax_tags";

export class AccountTaxInfo extends Many2ManyTaxTagsField {
    static template = "account.AccountTaxInfo"
    static props = {
        ...Many2ManyTaxTagsField.props
    }

    setup() {
        super.setup();
        this.accountTaxPopup = usePopover(AccountTaxPopup);
        this.orm = useService("orm");
        this.state = useState({
            allTaxes: [],
        });
        onWillStart(async () => {
            await this.fetchAllTaxes();
        });
    }

    async fetchAllTaxes() {
        if (this.props.record.evalContext.id) {
            let result = await this.orm.read("account.move.line", [this.props.record.evalContext.id], ["tax_ids_info"]);
            if (result && result.length) {
                let taxInfo = result[0].tax_ids_info;
                if (taxInfo) {
                    this.state.allTaxes = taxInfo;
                }
            }
        }
    }

    getAccountTaxProps() {
        return {
            id: this.props.record.evalContext.id,
            allTaxes: this.state.allTaxes,
        };
    }

    openTaxPopupComponent(ev) {
        const target = ev.currentTarget;
        this.accountTaxPopup.open(target, this.getAccountTaxProps());
    }
}

export const accountTaxInfo = {
    component: AccountTaxInfo,
};

registry.category("fields").add("tax_ids_info", accountTaxInfo);
