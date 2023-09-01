/** @odoo-module **/


const { Component, mount, xml, useState } = owl;
import Tool from "./components/tool.js";
import toolRegistry from "./components/registry/toolRegistry.js";
import { CanvasDrawer } from "./components/canvas.js";

const TEMPLATE = xml/* xml */ `
    <div>
        <div class="row position-absolute top-0 start-50 translate-middle-x" style="z-index:10;">
            <div>
                <div class="row" style="min-width: max-content">
                    <div class="col-8">
                        <div id="tool-options" class="btn-group mb-3" role="group" aria-label="Tool Selection">
                            <t t-foreach="tools" t-as="tool" t-key="tool.name">
                                <Tool toolName="tool.name" iconClass="tool.icon" onSelectTool="selectTool" />
                            </t>
                        </div>
                    </div>
                    <div class="col-4 text-end">
                        <div id="undo-redo" class="btn-group mb-3" role="group" aria-label="Undo Redo Actions">
                            <t t-foreach="actions" t-as="action" t-key="action.id">
                                <button class="btn btn-outline-secondary d-flex flex-column align-items-center" t-on-click="action.key">
                                    <i t-att-class="action.icon"></i>
                                    <span><t t-esc="action.name"/></span>
                                </button>
                            </t>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <CanvasDrawer selectedTool="selectedTool.value" canvasElements="elements"/>
    </div> 
`;

export class Draw extends Component {
    static template = TEMPLATE;
    static components = { Tool, CanvasDrawer };

    setup() {
        this.tools = toolRegistry.getAll();
        this.actions = useState([
            { id: 1, name: "Undo", key: "undo", icon: "fa fa-rotate-left" },
            { id: 2, name: "Redo", key: "redo", icon: "fa fa-rotate-right" },
        ]);
        this.selectedTool = useState({ value: "" });
        this.elements = this.props.canvasElements || [];
        console.log('this.props.canvasElements from app.js file are: ', this.elements);
    }

    selectTool = (toolName) => {
        this.selectedTool.value = toolName;
    };
}

