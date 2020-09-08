odoo.define("poc.ViewController", function (require) {

    const { useModel } = require("web/static/src/js/model.js");

    const {
        Component,
        hooks: {
            useState,
        },
        tags: {
            xml,
        },
    } = owl;

    class ViewController extends Component {
        constructor() {
            super(...arguments);

            this.model = useModel("model");
            this.state = useState({
                selectedMeasures: Array.from(this.props.activeMeasures),
            });
        }

        get measures() {
            return Object.entries(this.props.measures)
                .filter(([k]) => k !== "__count")
                .sort(([,a], [,b]) => a.string.toLowerCase() > b.string.toLowerCase() ? 1 : -1);
        }

        _download() {
        }
        _expandAll() {
            this.model.dispatch("expandAll");
        }
        _flipAxis() {
            this.model.dispatch("flip");
        }
        _toggleMeasure(fieldName) {
            const index = this.state.selectedMeasures.indexOf(fieldName);
            if (index >= 0) {
                this.state.selectedMeasures.splice(index, 1);
            } else {
                this.state.selectedMeasures.push(fieldName);
            }
            this.model.dispatch("toggleMeasure", fieldName);
        }
    }
    ViewController.template = xml/*xml*/`
        <div>
            <div class="btn-group" role="toolbar" aria-label="Main actions">
                <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown" aria-expanded="false">
                    Measures
                </button>
                <div class="dropdown-menu o_pivot_measures_list" role="menu">
                    <t t-foreach="measures" t-as="measure">
                        <a role="menuitem" href="#"
                            class="dropdown-item"
                            t-att-class="{selected: state.selectedMeasures.includes(measure[0])}"
                            t-on-click.stop.prevent="_toggleMeasure(measure[0])"
                        >
                            <t t-esc="measure[1].string"/>
                            <t t-if="measure[1].type === 'many2one'"> (count)</t>
                        </a>
                    </t>
                    <div role="separator" class="dropdown-divider"/>
                    <a role="menuitem" href="#"
                        class="dropdown-item"
                        t-att-class="{selected: state.selectedMeasures.includes('__count')}"
                        t-on-click.stop.prevent="_toggleMeasure('__count')">Count</a>
                </div>
            </div>
            <div class="btn-group" role="toolbar" aria-label="Pivot settings">
                <button class="btn btn-secondary fa fa-exchange" title="Flip axis" aria-label="Flip axis" t-on-click.stop.prevent="_flipAxis()"/>
                <button class="btn btn-secondary fa fa-arrows" title="Expand all" aria-label="Expand all" t-on-click.stop.prevent="_expandAll()"/>
                <button class="btn btn-secondary fa fa-download" title="Download xlsx" aria-label="Download xlsx" t-on-click.stop.prevent="_download()"/>
            </div>
        </div>
    `;

    return ViewController;
});
