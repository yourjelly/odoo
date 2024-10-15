import {
    Component,
    useState,
    useRef,
} from "@odoo/owl";
import { usePosition } from "@web/core/position/position_hook";

export class AccountTaxPopup extends Component {
    static template = "account.AccountTaxPopup";
    static props = {
        id: { type: Number },
        allTaxes: { type: Object },
        close: { type: Function },
    }

    setup() {
        this.state = useState({
            showDropdown: true,
        });
        this.widgetRef = useRef("accountTax");
        usePosition("accountTaxDropdown", () => this.widgetRef.el);
    }

    closeAccountTaxPopup() {
        this.state.showDropdown = false;
    }
}
