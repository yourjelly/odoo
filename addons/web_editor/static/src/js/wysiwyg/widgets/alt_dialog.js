/** @odoo-module **/


import { Component, xml, useRef } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

export class AltDialog extends Component {
    static components = { Dialog };
    static props = {
        confirm: Function,
        close: Function,
        alt: String,
        tag_title: String,
    };
    static template = xml`
        <Dialog size="'xl'" title="'Change media description and tooltip'">
            <form action="#">
                <div class="mb-3 row">
                    <label class="col-md-3 col-form-label" for="alt"
                        title="'Alt tag' specifies an alternate text for an image, if the image cannot be displayed (slow connection, missing image, screen reader ...).">
                    Description <small>(ALT Tag)</small>
                    </label>
                    <div class="col-md-8">
                        <input class="form-control" t-ref="alt" required="required" t-att-value="props.alt" type="text"/>
                    </div>
                </div>
                <div class="mb-3 row">
                    <label class="col-md-3 col-form-label" for="title"
                        title="'Title tag' is shown as a tooltip when you hover the picture.">
                    Tooltip  <small>(TITLE Tag)</small>
                    </label>
                    <div class="col-md-8">
                        <input class="form-control" t-ref="tag_title" required="required" t-att-value="props.tag_title" type="text"/>
                    </div>
                </div>
            </form>
            <t t-set-slot="footer" owl="1">
                <button class="btn btn-primary" t-on-click="_confirm">Save</button>
                <button class="btn btn-secondary" t-on-click="_cancel">Discard</button>
            </t>
        </Dialog>
    `;
    altRef = useRef("alt");
    tagTitleRef = useRef("tag_title");

    setup() {
        this.isConfirmedOrCancelled = false; // ensures we do not confirm and/or cancel twice
    }
    async _cancel() {
        if (this.isConfirmedOrCancelled) {
            return;
        }
        this.isConfirmedOrCancelled = true;
        this.props.close();
    }
    async _confirm() {
        if (this.isConfirmedOrCancelled) {
            return;
        }
        this.isConfirmedOrCancelled = true;
        try {
            const allNonEscQuots = /"/g;
            const alt = this.altRef.el.value.replace(allNonEscQuots, "&quot;");
            const title = this.tagTitleRef.el.value.replace(allNonEscQuots, "&quot;");
            await this.props.confirm(alt, title);
        } catch (e) {
            this.props.close();
            throw e;
        }
        this.props.close();
    }
}
