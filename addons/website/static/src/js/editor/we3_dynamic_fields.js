odoo.define('website.editor.we3.dynamicfield', function (require) {
'use strict';

const TagMany2one = class extends we3.AbstractPlugin {

    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/website/static/src/xml/dynamic_fields.xml'];
        this.dependencies = ['Arch', 'Rules'];
        this.buttons = {
            template: 'website.fields.many2one',
            active: '_active',
            enabled: '_enabled',
        };
    }

    start () {
        this.buttons.elements[0].querySelector('input').addEventListener('input', this._onInputRecordChange.bind(this));
        this.container = this.buttons.elements[0];
        // TODO: debug the bug when trying to add voidoid check to allow inserting anything inside a TagMany2one
        // this.dependencies.Rules.addVoidoidCheck(this.getArchNode.bind(this));
    }

    getArchNode (archNode) {
        this.currentNode = archNode.ancestor(node => node.attributes && node.attributes['data-oe-type'] === 'contact');
        // todo: handle the population once the node is in the arch and the template has been rendered
        // populate the popup with the one2many default data
        if (this.currentNode) {
            this._onInputRecordChange();
        }
        return this.currentNode;
    }

    isMany2One () {
        return true;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _onInputRecordChange () {
        const domain = [];
        const name = this.container.querySelector('input').value;
        const modelName = this.currentNode.attributes['data-oe-many2one-model'];
        console.log('modelName:', modelName);
        // if there is no name, let the domain be empty
        if (!name) {
            true;
        } else if (isNaN(+name)) {
            if (modelName === 'res.partner') {
                domain.push('|', ['name', 'ilike', name], ['email', 'ilike', name]);
            } else {
                domain.push(['name', 'ilike', name]);
            }
        } else {
            domain.push(['id', '=', name]);
        }
        return this.options.rpc({
            model: modelName,
            method: 'search_read',
            args: [domain, modelName === 'res.partner' ? ['name', 'display_name', 'city', 'country_id'] : ['name', 'display_name']],
            kwargs: {
                order: [{name: 'name', asc: false}],
                limit: 5,
            },
        }).then((result) => {
            this._renderRecords(result || []);
        });
    }

    _renderRecords (records) {
        // clear the partners
        this.container.querySelectorAll('we3-button').forEach((el)=>el.remove());
        records.slice().forEach((record) => {
            this.container.appendChild(this._renderRecord(record));
        });
    }
    _renderRecord (record) {
        const button = document.createElement('we3-button');
        const span = document.createElement('we3-span');
        button.appendChild(span);
        span.innerText = record.display_name;
        button.setAttribute('data-method', '_changeRecord');
        button.setAttribute('data-value', record.id);
        if (record.city || record.country_id) {
            const cityNode = document.createTextNode(` (${record.city}${record.country_id && ' ' + record.country_id[1]})`);
            button.appendChild(cityNode);
        }
        return button;
    }

    _changeRecord (value, focusNode, ev) {
        // TODO: what is the difference between oe-id or many2one-id?
        const id = parseInt(value);
        this.getArchNode(focusNode);
        this.currentNode.attributes['data-oe-many2one-id'] = id;

        // const id = currentNode.data('oe-id');
        if (this.currentNode.attributes['data-oe-type'] === 'contact') {
            // TODO: remove me when the attribute of an archnode is properly parsed/decoded
            var options = JSON.parse(
                            this._decodeString(this.currentNode.attributes['data-oe-contact-options']));
            this.options.rpc({
                model: 'ir.qweb.field.contact',
                method: 'get_record_to_html',
                args: [[id]],
                kwargs: {
                    options: options,
                },
            }).then((htmlContent, ...args) => {
                this._insertAtNode(this.currentNode, htmlContent);
            });
        } else {
            this._insertAtNode(this.currentNode, this.currentNode.attributes['data-name']);
        }
    }

    // todo: remove me when the attribute of an archnode is properly parsed/decoded
    _decodeString (encodedStr) {
        const parser = new DOMParser;
        const dom = parser.parseFromString(
            '<!doctype html><body>' + encodedStr,
            'text/html');
        return dom.body.textContent;
    }

    _insertAtNode (node, htmlContent) {
        this.dependencies.Arch.do(() => {
            const archNode = this.getArchNode(node);
            archNode.empty();
            this.dependencies.Arch.insert('<span>waiting todo</span>', archNode, 0);
            // todo: replace previous line with the following one when addVoidoidCheck works.
        });
    }

    _active (buttonName, focusNode) {
        return true;
    }

    _enabled (buttonName, focusNode) {
        return focusNode.isMany2one && focusNode.isMany2one();
    }
};

// we3.addArchNode('We3Many2OneNode', We3Many2OneNode);
we3.addPlugin('TagMany2one', TagMany2one);

});
