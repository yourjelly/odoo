/** @odoo-module **/

import { registry } from "../../core/registry";

const { Component } = owl;
const { useSubEnv } = owl.hooks;

const fieldRegistry = registry.category("fields");

export class Field extends Component {
    static template = owl.tags.xml`
        <t t-component="component" t-props="props" />`;

    setup() {
        let type = this.props.type;
        if (!type) {
            let fields = this.env.model.fields;
            type = fields[this.props.name].type;
        }
        this.component = fieldRegistry.get(type, FieldChar);
    }
}

class FieldChar extends Component {
    static template = owl.tags.xml`
        <t t-if="props.mode === 'readonly'">
            <span class="o-field"><t t-esc="data"/></span>
        </t>`;

    setup() {
        this.record = this.props.record;
        this.data = this.record.data[this.props.name];
    }
}

fieldRegistry.add("char", FieldChar);

class FieldMany2one extends Component {
    static template = owl.tags.xml`
        <t t-if="props.mode === 'readonly'">
            <span class="o-field"><t t-esc="data"/></span>
        </t>`;

    setup() {
        const data = this.props.record.data[this.props.name];
        this.data = data ? data[1] : "";
    }
}

fieldRegistry.add("many2one", FieldMany2one);

export class FormRenderer extends Component {
    static template = owl.tags.xml`
        <div>
            <div>hello form renderer</div>
            <ul>
                <li><Field type="'char'" name="'city'" record="record" mode="'readonly'"/></li>
                <li><Field name="'display_name'" record="record" mode="'readonly'"/></li>
                <li><Field type="'many2one'" name="'state_id'" record="record" mode="'readonly'"/></li>
            </ul>
        </div>`;

    static components = { Field };
    setup() {
        useSubEnv({ model: this.props.model });
        this.record = this.props.model.root;
    }
}
