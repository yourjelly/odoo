import { usePos } from "@point_of_sale/app/store/pos_hook";

import { Component, useState, useExternalListener } from "@odoo/owl";

export class PosOrderCount extends Component {
    static template = "pos_deliveroo.PosOrderCount";
    static components = {};
    static props = {};
    setup() {
        this.pos = usePos();
        this.state = useState({ isMenuOpened: false });
        useExternalListener(window, "mouseup", this.onOutsideClick);
    }

    isOrderCountMenuClosed() {
        return !this.state.isMenuOpened;
    }

    async onTicketButtonClick() {
        this.pos.showScreen("TicketScreen");
    }

    openMenu() {
        this.state.isMenuOpened = true;
    }

    closeMenu() {
        this.state.isMenuOpened = false;
    }

    onOutsideClick() {
        if (this.state.isMenuOpened) {
            this.state.isMenuOpened = false;
        }
    }
}
