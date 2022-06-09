/** @odoo-module **/

import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { ProgressBarField } from "@web/core/progress_bar";

const { onWillUpdateProps } = owl;

export class SalesTeamProgressBar extends ProgressBarField {
    setup() {
        super.setup();

        // TODO: need to add onWillStart hook ?

        onWillUpdateProps(async (nextProps) => {
            // old
            // const isUnset = !this.recordData[this.nodeOptions.max_value];
            const isUnset = nextProps.maxValue.value;

            if (isUnset) {
                const msg = document.createElement('a');

                msg.innerText = _t('Click to define an invoicing target');
                msg.setAttribute('href', '#');
                // TODO: better way of adding listener ?
                msg.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    mgs.parentElement.removeChild(msg);

                    for (let child of this.el.children) {
                        child.classList.remove('d-none');
                    }

                    this.el.insertBefore(msg, this.el.firstChild);
                });
            }
        });
    }
}

// TODO: add xml template

registry.category('fields').add('sales_team_progressbar', SalesTeamProgressBar);