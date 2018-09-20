odoo.define('web_diagram_view.WebDiagramModel', function (require) {
"use strict";

var AbstractModel = require('web.AbstractModel');
var DiagramModel = require('web_diagram.DiagramModel');

/**
 * DiagramModel
 */
var WebDiagramModel = DiagramModel.extend({

	_fetchDiagramInfo: function () {
        var self = this;
        return this._rpc({
                route: '/web_diagram/diagram/get_diagram',
                params: {
                    id: this.res_id,
                    model: this.modelName,
                    node: this.node_model,
                    connector: this.connector_model,
                    src_node: this.connectors.attrs.source,
                    des_node: this.connectors.attrs.destination,
                    label: this.connectors.attrs.label || false,
                    bgcolor: this.nodes.attrs.bgcolor,
                    shape: this.nodes.attrs.shape,
                    visible_nodes: this.visible_nodes,
                    invisible_nodes: this.invisible_nodes,
                    node_fields_string: this.node_fields_string,
                    connector_fields_string: this.connector_fields_string,
                },
            })
            .then(function (data) {
                self.datanodes = data.nodes;
                self.edges = data.conn;
                self.parent_field = data.parent_field;
                self.display_name = data.display_name;
            });
    },
});

return WebDiagramModel;
});