/* @odoo-module */

import { registry } from "@web/core/registry";
import { Model, useModel } from "@web/views/helpers/model";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { XMLParser } from "@web/core/utils/xml";
import { KeepLast } from "@web/core/utils/concurrency";
import { useService } from "@web/core/service_hook";
import { useDebugMenu } from "../../core/debug/debug_menu";

// -----------------------------------------------------------------------------
class FormModel extends Model {
    static services = ["orm"];

    setup({ orm }) {
        this.orm = orm;
        this.keepLast = new KeepLast();
    }

    load(params) {
        this.model = params.resModel;
        this.columns = params.columns;
        return this.loadData(params.domain);
    }

    reload(params) {
        return this.loadData(params.domain);
    }

    async loadData(domain) {
        const fields = this.columns.map((col) => col.name);
        this.data = await this.keepLast.add(
            this.orm.searchRead(this.model, domain, fields, { limit: 40 })
        );
        this.notify();
    }
}

// -----------------------------------------------------------------------------

class FormArchParser extends XMLParser {
    parse(arch) {
        const columns = [];
        this.visitXML(arch, (node) => {
            if (node.tagName === "field") {
                columns.push({
                    type: "field",
                    name: node.getAttribute("name")
                });
            }
        });
        return { columns };
    }
}

// -----------------------------------------------------------------------------

class FormView extends owl.Component {
    static type = "form";
    static display_name = "Form";
    static multiRecord = false;

    static template = owl.tags.xml`
    <div class="o_list_view">
      <ControlPanel t-props="props.info" />
      <div class="o_content">
        <table class="o_list table table-sm table-hover">
          <tbody class="ui-sortable">
            <tr t-foreach="model.data" t-as="record" t-key="record.id" class="o_data_row">
              <t t-foreach="archInfo.columns" t-as="column" t-key="column_index">
                <td class="o_data_cell" t-on-click="openRecord(record)">
                  <t t-esc="record[column.name]"/>
                </td>
              </t>
            </tr>
          </tbody>
        </table>
    </div>
  </div>`;

    static components = { ControlPanel };

    setup() {
        debugger;
        useDebugMenu("view", { component: this });
        this.archInfo = new FormArchParser().parse(this.props.arch);
        this.actionService = useService("action");
        this.model = useModel(FormModel, {
            resModel: this.props.resModel,
            columns: this.archInfo.columns,
            domain: this.props.domain
        });
    }

    openRecord(record) {
        const resIds = this.model.data.map((record) => record.id);
        this.actionService.switchView("form", { resId: record.id, resIds });
    }
}
registry.category("views").add("form", FormView);
