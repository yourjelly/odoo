odoo.define('web_diagram_view.view_registry', function (require) {
"use strict";

var view_registry = require('web.view_registry');

var DiagramView = require('web_diagram_view.WebDiagramView');

view_registry.add('diagram', DiagramView);

});