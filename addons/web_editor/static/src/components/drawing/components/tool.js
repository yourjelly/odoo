/** @odoo-module **/


const { Component, xml } = owl;

export default class Tool extends Component {
    static template = xml`
        <div id="tool-options" class="btn-group mb-3" role="group" aria-label="Tool Selection">
            <input type="radio" class="btn-check" name="tool" t-att-id="props.toolName" t-on-change="onSelectTool" autocomplete="off" />
            <label class="btn custom-btn" t-att-for="props.toolName">
                <i t-att-class="props.iconClass"></i>
                <span class="btn-label"><t t-esc="props.toolName"/></span>
            </label>
        </div>
    `;

    onSelectTool() {
        this.props.onSelectTool(this.props.toolName);
    }
}