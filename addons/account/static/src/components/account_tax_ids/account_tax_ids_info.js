import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import {
    Component,
    onWillStart,
    useState
} from "@odoo/owl";
import { AccountTaxPopup } from "./account_tax_ids_popup";
import { usePopover } from "@web/core/popover/popover_hook";
import { TagsList } from "@web/core/tags_list/tags_list";

export class AccountTaxInfo extends Component {
    static template = "account.AccountTaxInfo";
    static components = {
        TagsList,
    }

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            allTaxes: [],
        });
        this.accountTaxPopup = usePopover(AccountTaxPopup);
        this.openTaxJsonComponent = this.openTaxJsonComponent.bind(this);
        onWillStart(this.willStart);
    }

    async willStart() {
        if (this.editingRecord) {
            await this.fetchAllTaxes();
        }
    }

    async fetchAllTaxes() {
        this.state.allTaxes = await this.orm.call("account.move.line", "get_account_tax_json", [], {id: this.props.record.evalContext.id});
    }

    getAccountTaxProps() {
        return {
            id: this.props.record.evalContext.id,
            readOnly: true,
            allTaxes: this.state.allTaxes
        };
    }

    openTaxJsonComponent(ev) {
        const target = ev.currentTarget;
        this.accountTaxPopup.open(target, this.getAccountTaxProps());
    }

    accountTaxTags() {
        if (Object.keys(this.state.allTaxes).length === 0) {
            return [];  // Return an empty array if taxes are not loaded yet
        }
        return Object.values(this.state.allTaxes['tax_ids']).map((tax) => {
            return {
                text: tax,  // Get the 'tax_name' directly from 'tax'
            };
        });
    }

    get editingRecord() {
        return this.props.readonly;
    }
}

export const accountTaxInfo = {
    component: AccountTaxInfo,
    supportedTypes: ["char", "text"],
};
registry.category("fields").add("tax_ids_info", accountTaxInfo);
