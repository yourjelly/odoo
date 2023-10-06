/** @odoo-module **/

import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { RecordAutocomplete } from "./record_autocomplete";
import { _t } from "@web/core/l10n/translation";

export class RecordSelector extends Component {
    static props = {
        resModel: String,
        update: Function,
        domain: { type: Array, optional: true },
        context: { type: Object, optional: true },
        value: true,
        fieldString: { type: String, optional: true },
    };
    static components = { RecordAutocomplete };
    static template = "web.RecordSelector";

    setup() {
        this.nameService = useService("name");
        onWillStart(() => this.computeDerivedParams());
        onWillUpdateProps((nextProps) => this.computeDerivedParams(nextProps));
    }

    async computeDerivedParams(props = this.props) {
        const displayNames = await this.getDisplayNames(props);
        this.displayName = this.getDisplayName(props, displayNames);
    }

    async getDisplayNames(props) {
        const ids = this.getIds(props);
        return this.nameService.loadDisplayNames(props.resModel, ids);
    }

    getDisplayName(props = this.props, displayNames) {
        const { value } = props;
        if (value === false) {
            return "";
        }
        return typeof displayNames[value] === "string"
            ? displayNames[value]
            : _t("Inaccessible/missing record ID: %s", value);
    }

    getIds(props = this.props) {
        if (props.value) {
            return [props.value];
        }
        return [];
    }

    update(resIds) {
        this.props.update(resIds[0] || false);
        this.render(true);
    }
}
