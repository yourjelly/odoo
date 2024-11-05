import { useCashierSelector } from "@pos_hr/app/select_cashier_mixin";
import { _t } from "@web/core/l10n/translation";
import { LoginScreen } from "@point_of_sale/app/screens/login_screen/login_screen";
import { patch } from "@web/core/utils/patch";
import { useAutofocus } from "@web/core/utils/hooks";
import { onWillUnmount, useExternalListener, useState } from "@odoo/owl";

patch(LoginScreen.prototype, {
    setup() {
        super.setup(...arguments);

        this.state = useState({
            pin: "",
            login: false,
        });

        if (this.pos.config.module_pos_hr) {
            this.selectCashier = useCashierSelector({
                onScan: (employee) => employee && this.selectEmployee(employee),
                exclusive: true,
            });

            useAutofocus();
            useExternalListener(window, "keypress", async (ev) => {
                if (this.state.login && ev.key === "Enter" && this.state.pin) {
                    await this.selectCashier(this.state.pin, true);
                }
            });
        }

        onWillUnmount(() => {
            this.state.pin = "";
            this.state.login = false;
        });
    },
    selectEmployee(employee) {
        this.pos.cashier.employee = employee;
    },
    unlockRegister() {
        this.state.login = true;
    },
    openRegister() {
        if (this.pos.config.module_pos_hr) {
            this.state.login = true;
        } else {
            super.openRegister();
        }
    },
    async clickBack() {
        if (!this.pos.config.module_pos_hr) {
            super.clickBack();
            return;
        }

        if (this.state.login) {
            this.state.pin = "";
            this.state.login = false;
        } else {
            const employee = await this.selectCashier();
            if (
                employee &&
                (employee._role === "manager" || employee.user_id?.id === this.pos.user.id)
            ) {
                super.clickBack();
                return;
            }
        }
    },
    get backBtnName() {
        return this.state.login && this.pos.config.module_pos_hr
            ? _t("Discard")
            : super.backBtnName;
    },
});
