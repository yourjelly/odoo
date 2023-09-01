/** @odoo-module **/


const { Component, xml, useState, onPatched } = owl;

export default class PropertiesPanel extends Component {
    static template = xml`
        <div class="position-absolute p-3 bg-light rounded" 
             style="left: 2%; top: 10%; width: 200px; z-index: 99; opacity: 0.95; border: 1px solid #ccc;">
            <div class="mb-3">
                <label for="strokeWidth" class="form-label">Stroke Width</label>
                <input type="range" class="form-range" id="strokeWidth" min="1" max="5" t-model="state.strokeWidth" t-on-change="updateProperties"/>
            </div>
            <div class="mb-3">
                <label for="stroke" class="form-label">Stroke Color</label>
                <input type="color" class="form-control form-control-color" id="stroke" t-model="state.stroke" t-on-change="updateProperties"/>
            </div>
            <div class="mb-3">
                <label for="fill" class="form-label">Fill Color</label>
                <input type="color" class="form-control form-control-color" id="fill" t-model="state.fill" t-on-change="updateProperties"/>
            </div>
            <div class="mb-3">
                <label for="fillStyle" class="form-label">Fill Style</label>
                <select class="form-select" id="fillStyle" t-model="state.fillStyle" t-on-change="updateProperties">
                    <option value="solid">Solid</option>
                    <option value="zigzag">Zig-Zag</option>
                    <option value="cross-hatch">Cross-Hatch</option>
                    <option value="dashed">Dashed</option>
                </select>
            </div>
        </div>
    `;

    state = useState({
        strokeWidth: 1,
        stroke: "#000000",
        fill: "",
        fillStyle: "solid",
    });

    updateProperties() {
        const newProperties = {
            strokeWidth: this.state.strokeWidth,
            stroke: this.state.stroke,
            fill: this.state.fill,
            fillStyle: this.state.fillStyle,
        };
        this.props.data(newProperties);
    }
}
