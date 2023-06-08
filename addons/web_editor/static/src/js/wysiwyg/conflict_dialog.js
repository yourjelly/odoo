/* @odoo-module */

import { Component, xml } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

export class ConflictDialog extends Component {
    static components = { Dialog };
    static props = ["close","content"];
    static template = xml`
        <Dialog size="'xl'" title="'Content conflict'">
            <div>
                <div style="color: red;">
                    <p>
                        There is a conflict between your version and the one in the database.
                    </p>
                    <p>
                        The version from the database will be used.
                        If you need to keep your changes, copy the content below and edit the new document.
                    </p>
                    <p style="font-weight: bold;">
                        Warning: after closing this dialog, the version you were working on will be discarded and will never be available anymore.
                    </p>
                </div>
            </div>
            <t t-out="props.content"/>
        </Dialog>
    `;
}
