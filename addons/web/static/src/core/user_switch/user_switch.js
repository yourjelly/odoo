import { Component, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { lastUsers, registerUsers } from "@web/core/user";
import { imageUrl } from "@web/core/utils/urls";

export class UserSwitch extends Component {
    static template = "web.login_user_switch";
    static props = {};

    setup() {
        super.setup();
        const users = lastUsers();
        this.state = useState({
            users,
            displayUserChoice: users.length > 0,
        });
        this.inputSelector =
            ".oe_login_form > div:not(.oe_login_buttons), .oe_login_buttons > *:not(.o_login_auth)";
        this.initializeUI();
    }
    initializeUI() {
        if (this.state.displayUserChoice) {
            this._maskInputForm();
        }
        this.form.classList.remove("d-none");
    }

    _maskInputForm() {
        for (const node of this.form.querySelectorAll(this.inputSelector)) {
            node.classList.add("d-none");
        }
    }

    _unmaskInputForm() {
        for (const node of this.form.querySelectorAll(this.inputSelector)) {
            node.classList.remove("d-none");
        }
    }

    toggleFormDisplay() {
        this.state.displayUserChoice = !this.state.displayUserChoice && this.users.length;
        if (this.state.displayUserChoice) {
            this._maskInputForm();
        } else {
            this._unmaskInputForm();
            this.form.querySelector("input#login").focus();
        }
    }

    getAvatarUrl({ partnerId, partnerWriteDate: unique }) {
        return imageUrl("res.partner", partnerId, "avatar_128", { unique });
    }

    remove(deletedUser) {
        this.state.users = this.users.filter((user) => user !== deletedUser);
        registerUsers(this.users);
        if (!this.users.length) {
            this.fillForm();
        }
    }

    fillForm(login = "") {
        this.form.querySelector("input#login").value = login;
        this.form.querySelector("input#password").value = "";
        this.toggleFormDisplay();
        const input = login.length ? "input#password" : "input#login";
        this.form.querySelector(input).focus();
    }

    get displayUserChoice() {
        return this.users.length && this.state.displayUserChoice;
    }

    get displayBackButton() {
        return !this.displayUserChoice && this.users.length > 0;
    }

    get form() {
        return document.querySelector("form.oe_login_form");
    }

    get users() {
        return this.state.users;
    }
}

registry.category("public_components").add("web.user_switch", UserSwitch);
