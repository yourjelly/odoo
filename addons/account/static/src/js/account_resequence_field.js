odoo.define('account.ShowReseqenceRenderer', function (require) {
"use strict";

const { Component } = owl;
const { useState } = owl.hooks;
const AbstractFieldOwl = require('web.AbstractFieldOwl');
const field_registry = require('web.field_registry');

class ChangeLine extends Component { }
ChangeLine.template = 'account.ResequenceChangeLine';
ChangeLine.props = ["changeLine", 'ordering'];


class ShowReseqenceRenderer extends AbstractFieldOwl {
    constructor(...args) {
        super(...args);
        this.data = this.value ? JSON.parse(this.value) : {
            changeLines: [],
            ordering: 'date',
        }
    }
    async willUpdateProps(nextProps) {
        await super.willUpdateProps(nextProps);
        Object.assign(this.data, JSON.parse(this.value));
    }
}
ShowReseqenceRenderer.template = 'account.ResequenceRenderer';
ShowReseqenceRenderer.components = { ChangeLine }

field_registry.add('account_resequence_widget', ShowReseqenceRenderer);
return ShowReseqenceRenderer;
});
