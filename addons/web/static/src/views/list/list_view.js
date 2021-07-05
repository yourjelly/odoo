/* @odoo-module */

import { registry } from "@web/core/registry";
import { XMLParser } from "@web/core/utils/xml";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useModel } from "@web/views/helpers/model";
import { useDebugMenu } from "../../core/debug/debug_menu";
import { ListModel } from "./list_model";
import { ListRenderer } from "./list_renderer";

class ListArchParser extends XMLParser {
    parse(arch, fields) {
        const columns = [];
        this.visitXML(arch, (node) => {
            if (node.tagName === "field") {
                if (
                    node.getAttribute("invisible") !== "1" &&
                    node.getAttribute("optional") !== "hide"
                ) {
                    const name = node.getAttribute("name");
                    const string = node.getAttribute("string") || fields[name].string;
                    columns.push({
                        type: "field",
                        name,
                        string
                    });
                }
            }
        });
        return { columns };
    }
}

// -----------------------------------------------------------------------------

class ListView extends owl.Component {
    static type = "list";
    static display_name = "List";
    static icon = "fa-list-ul";
    static multiRecord = true;
    static template = `web.ListView`;
    static components = { ControlPanel, ListRenderer };

    setup() {
        useDebugMenu("view", { component: this });
        this.archInfo = new ListArchParser().parse(this.props.arch, this.props.fields);
        this.model = useModel(ListModel, {
            resModel: this.props.resModel,
            columns: this.archInfo.columns,
            domain: this.props.domain
        });
    }
}
registry.category("views").add("list", ListView);
