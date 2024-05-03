import { Component, useState, useExternalListener } from "@odoo/owl";

export class PosOrderCount extends Component {
    static template = "pos_deliveroo.PosOrderCount";
    static components = {};
    static props = {};
    setup() {
        this.state = useState({ isMenuOpened: false });
        useExternalListener(window, "mouseup", this.onOutsideClick);
    }

    isBurgerMenuClosed() {
        return !this.state.isMenuOpened;
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
