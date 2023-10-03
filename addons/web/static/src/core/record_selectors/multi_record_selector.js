/** @odoo-module **/

import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { TagsList } from "@web/core/tags_list/tags_list";
import { useService } from "@web/core/utils/hooks";
import { RecordAutocomplete } from "./record_autocomplete";
import { isId, getFormat } from "./helpers";

export class MultiRecordSelector extends Component {
    static props = {
        resModel: String,
        update: Function,
        value: true,
        domain: { type: Array, optional: true },
        context: { type: Object, optional: true },
        fieldString: { type: String, optional: true },
    };
    static components = { RecordAutocomplete, TagsList };
    static template = "web.MultiRecordSelector";

    setup() {
        this.nameService = useService("name");
        onWillStart(() => this.computeDerivedParams());
        onWillUpdateProps((nextProps) => this.computeDerivedParams(nextProps));
    }

    async computeDerivedParams(props = this.props) {
        const displayNames = await this.getDisplayNames(props);
        this.tags = this.getTags(props, displayNames);
    }

    async getDisplayNames(props) {
        const ids = this.getIds(props);
        return this.nameService.loadDisplayNames(props.resModel, ids);
    }

    getIds(props = this.props) {
        return props.value.filter((val) => isId(val));
    }

    getTags(props, displayNames) {
        return props.value.map((val, index) => {
            const { text, colorIndex } = getFormat(val, displayNames);
            return {
                text,
                colorIndex,
                onDelete: () => {
                    this.props.update([
                        ...this.props.value.slice(0, index),
                        ...this.props.value.slice(index + 1),
                    ]);
                },
            };
        });
    }

    update(resIds) {
        this.props.update([...this.props.value, ...resIds]);
    }
}
