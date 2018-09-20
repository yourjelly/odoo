odoo.define('web_diagram_view.WebDiagramView', function (require) {
"use strict";

var core = require('web.core');
var DiagramView = require('web_diagram.DiagramView');
var WebDiagramModel = require('web_diagram_view.WebDiagramModel');
var DiagramRenderer = require('web_diagram.DiagramRenderer');
var DiagramController = require('web_diagram_view.WebDiagramController');

var _lt = core._lt;

var WebDiagramView = DiagramView.extend({
    display_name: _lt('Diagram'),
    icon: 'fa-code-fork',
    multi_record: false,
    searchable: false,
    config: {
        Model: WebDiagramModel,
        Renderer: DiagramRenderer,
        Controller: DiagramController,
    },
    viewType: 'diagram',
});
return WebDiagramView;
});
