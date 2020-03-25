odoo.define("web.DomainSelector", function (require) {
    "use strict";

    const { _lt } = require('web.core');
    const { DatePicker, DateTimePicker } = require('web.DatePickerOwl');
    const Domain = require('web.Domain');
    const DropdownMenu = require('web.DropdownMenu');
    const field_utils = require('web.field_utils');
    const ModelFieldSelector = require('web.ModelFieldSelector');
    const pyUtils = require('web.py_utils');

    const { Component, hooks } = owl;
    const { useRef } = hooks;
    const DEFAULT_DOMAIN = ['id', '=', 1];
    const OPERATOR_MAPPING = {
        // Suggested
        '=': "=",
        '!=': _lt("is not ="),
        '>': ">",
        '<': "<",
        '>=': ">=",
        '<=': "<=",
        'ilike': _lt("contains"),
        'not ilike': _lt("does not contain"),
        'in': _lt("in"),
        'not in': _lt("not in"),
        // Accepted
        'child_of': _lt("child of"),
        'parent_of': _lt("parent of"),
        'like': "like",
        'not like': "not like",
        '=like': "=like",
        '=ilike': "=ilike",
        // Custom
        'is true': _lt("is true"),
        'is false': _lt("is false"),
        'set': _lt("is set"),
        'not set': _lt("is not set"),
    };

    class AbstractDomainNode extends Component {

        constructor() {
            super(...arguments);
            useDebug({ accessKey: 'node' });

            this._setupDomain(this.props);
        }

        async willUpdateProps(newProps) {
            this._setupDomain(newProps);
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        _setupDomain(newProps) {
            const props = Object.assign({}, this.props, newProps);
            this.domain = props.domain;
            return props;
        }

        //---------------------------------------------------------------------
        // Handlers
        //---------------------------------------------------------------------

        _onButtonMouseenter(className) {
            const classes = className.split(" ");
            this.el.classList.add(...classes);
        }

        _onButtonMouseleave(className) {
            const classes = className.split(" ");
            this.el.classList.remove(...classes);
        }
    }
    AbstractDomainNode.defaultProps = {
        readonly: true,
    };
    AbstractDomainNode.props = {
        domain: Array,
        model: String,
        readonly: Boolean,
    };

    class DomainLeaf extends AbstractDomainNode {
        constructor() {
            super(...arguments);

            this.OPERATOR_MAPPING = OPERATOR_MAPPING;

            this.fieldSelectorRef = useRef('field-selector');
            this.tagInputRef = useRef('tag-input');
        }

        async willStart() {
            await this._loadChain(this.splittedChain, this.props.model);
            this._setupDisplayInfo();
        }

        async willUpdateProps(newProps) {
            await super.willUpdateProps(...arguments);
            if (!this.selectedField) {
                const newModel = Object.assign({}, this.props, newProps).model;
                await this._loadChain(this.splittedChain, newModel);
            }
            this._setupDisplayInfo();
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        _setupDomain() {
            const { domain, model } = super._setupDomain(...arguments);
            const [newChain, newOperator, newValue] = domain[0];
            if (newChain !== this.chain || model !== this.props.model) {
                // Chain|model changed: invalidate the selectedField
                this.selectedField = null;
            }
            this.chain = newChain;
            this.operator = newOperator;
            this.value = newValue;
            this.splittedChain = (this.chain && this.chain.split('.')) || [];
        }

        /**
         * @private
         */
        _setupDisplayInfo() {
            this.operatorValue = this.operator;
            this.formattedValue = this.value;
            if (typeof this.value === 'boolean') {
                if (this.operator === '=') {
                    this.operatorValue = this.value ? 'is true' : 'not set';
                } else if (this.operator === '!=') {
                    this.operatorValue = this.value ? 'is false' : 'set';
                }
            } else if (this.selectedField && !this.selectedField.relation && !Array.isArray(this.value)) {
                try {
                    const parser = field_utils.parse[this.selectedField.type];
                    this.formattedValue = parser(this.value, this.selectedField);
                } catch (err) { }
            }
        }

        /**
         * @private
         * @param {string[]} chain
         * @param {string} model
         * @returns {Promise<boolean>}
         */
        async _loadChain(chain, model) {
            try {
                const rpc = this.rpc.bind(this);
                this.selectedField = await ModelFieldSelector.getField(chain, model, rpc);
            } catch (err) {
                this.env.services.notification.notify({
                    title: this.env._t("Invalid field chain"),
                    message: this.env._t(
                        "The field chain is not valid. Did you maybe use a non-existing field name or followed a non-relational field?"
                    ),
                    type: 'danger',
                });
                this.trigger('domain-change', { domain: this.domain, valid: false });
                this.selectedField = null;
            }
            const type = (this.selectedField && this.selectedField.type) || null;
            this.operators = this._getTypeOperators(type);
            this.selectionChoices = type === 'selection' && this.selectedField.selection;
        }

        /**
         * @private
         * @returns {Object}
         */
        _getTypeOperators(type) {
            const operators = {};
            let keys = [];
            switch (type) {
                case 'boolean':
                    keys = ['is true', 'is false'];
                    break;
                case 'char': case 'text': case 'html':
                    keys = ['=', '!=', 'ilike', 'not ilike', 'set', 'not set', 'in', 'not in'];
                    break;
                case 'many2many': case 'one2many': case 'many2one':
                    keys = ['=', '!=', 'ilike', 'not ilike', 'set', 'not set'];
                    break;
                case 'integer': case 'float': case 'monetary':
                    keys = ['=', '!=', '>', '<', '>=', '<=', 'ilike', 'not ilike', 'set', 'not set'];
                    break;
                case 'selection':
                    keys = ['=', '!=', 'set', 'not set'];
                    break;
                case 'date': case 'datetime':
                    keys = ['=', '!=', '>', '<', '>=', '<=', 'set', 'not set'];
                    break;
                default:
                    keys = Object.keys(OPERATOR_MAPPING);
                    break;
            }
            keys.forEach(key => operators[key] = OPERATOR_MAPPING[key]);
            return operators;
        }

        /**
         * Used to add a tag value when using an 'in' type operator.
         * @private
         */
        _addTag() {
            const tagValue = this.tagInputRef.el.value.trim();
            if (!tagValue.length) {
                return;
            }
            const chain = this.chain;
            const operator = this.operator;
            const value = Array.isArray(this.value) ? this.value : [this.value];
            value.push(tagValue);
            this.tagInputRef.el.value = "";
            this.trigger('domain-change', { domain: [[chain, operator, value]] });
        }

        /**
         * Used to remove a tag value when using an 'in' type operator.
         * @private
         * @param {number} tagIndex
         */
        _removeTag(tagIndex) {
            const chain = this.chain;
            const operator = this.operator;
            const value = this.value;
            value.splice(tagIndex, 1);
            this.trigger('domain-change', { domain: [[chain, operator, value]] });
        }

        //---------------------------------------------------------------------
        // Handlers
        //---------------------------------------------------------------------

        /**
         * @private
         * @param {OwlEvent} ev
         */
        async _onFieldChainChange(ev) {
            const { chain, field } = ev.detail;
            let operator = this.operator;
            let value = this.value;
            if (this.selectedField && field && field.type !== this.selectedField.type) {
                switch (field.type) {
                    case 'date':
                    case 'datetime':
                        const parser = field_utils.parse[field.type];
                        value = parser(moment(), { timezone: false });
                        if (value.toJSON) {
                            value = value.toJSON();
                        }
                        break;
                }
                const availableOperators = this._getTypeOperators(field.type);
                if (!(operator in availableOperators)) {
                    operator = Object.keys(availableOperators)[0];
                    switch (operator) {
                        case 'is true': operator = '='; value = true; break;
                        case 'is false': operator = '!='; value = true; break;
                        case 'set': operator = '!='; value = false; break;
                        case 'not set': operator = '='; value = false; break;
                    }
                }
            }
            this.trigger('domain-change', {
                domain: [[chain.join('.'), operator, value]],
                valid: Boolean(field),
            });
        }

        /**
         * @private
         * @param {Event} ev
         */
        async _onOperatorChange(ev) {
            const chain = this.chain;
            let operator = ev.target.value;
            let value = this.value;
            const type = (this.selectedField && this.selectedField.type) || null;
            const availableOperators = this._getTypeOperators(type);
            const valid = !type || operator in availableOperators;
            if (['in', 'not in'].includes(operator)) {
                if (!Array.isArray(value)) {
                    value = value.toString().split(",");
                }
            } else if (Array.isArray(value)) {
                value = value.join(",");
            }
            switch (operator) {
                case 'is true': operator = '='; value = true; break;
                case 'is false': operator = '!='; value = true; break;
                case 'set': operator = '!='; value = false; break;
                case 'not set': operator = '='; value = false; break;
            }
            this.trigger('domain-change', { domain: [[chain, operator, value]], valid });
        }

        /**
         * @private
         * @param {KeyboardEvent} ev
         */
        _onTagKeydown(ev) {
            switch (ev.key) {
                case 'Enter':
                    this._addTag();
                    break;
                case 'Backspace':
                    if (this.value.length) {
                        this._removeTag(this.value.length - 1);
                    }
                    break;
            }
        }

        /**
         * @private
         * @param {(Event|OwlEvent)} ev
         */
        async _onValueChange(ev) {
            const chain = this.chain;
            const operator = this.operator;
            const detail = { domain: [[chain, operator]] };
            const initialValue = ev.detail ? ev.detail.date : ev.target.value;
            try {
                const parser = field_utils.parse[this.selectedField.type];
                let value = parser(initialValue, this.selectedField);
                if (value.toJSON) {
                    value = value.toJSON();
                }
                detail.domain[0].push(value);
            } catch (err) {
                detail.valid = false;
                detail.domain[0].push(initialValue);
            }
            this.trigger('domain-change', detail);
        }
    }
    DomainLeaf.components = { DatePicker, DateTimePicker, ModelFieldSelector };
    DomainLeaf.props = Object.assign({}, AbstractDomainNode.props, {
        operators: { type: Array, optional: 1 },
    });
    DomainLeaf.template = 'web.DomainLeaf';

    class DomainTree extends AbstractDomainNode {

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        _setupDomain() {
            const { domain } = super._setupDomain(...arguments);
            this.operator = domain[0];
            this.childNodes = this._getChildNodes();
        }

        _getChildNodes() {
            const nodes = [];
            if (this.domain.length > 1) {
                // Add flattened children by search the appropriate number of children
                // in the rest of the domain (after the operator)
                let nbLeafsToFind = 1;
                for (let i = 1; i < this.domain.length; i++) {
                    if (this.domain[i] === "&" || this.domain[i] === "|") {
                        nbLeafsToFind++;
                    } else if (this.domain[i] !== "!") {
                        nbLeafsToFind--;
                    }

                    if (!nbLeafsToFind) {
                        const partLeft = this.domain.slice(1, i + 1);
                        const partRight = this.domain.slice(i + 1);
                        if (partLeft.length) {
                            nodes.push(partLeft);
                        }
                        if (partRight.length) {
                            nodes.push(partRight);
                        }
                        break;
                    }
                }
                this._isValid = (nbLeafsToFind === 0);

                // Mark "!" tree children so that they do not allow to add other
                // children around them
                if (this.operator === "!") {
                    nodes[0].noControlPanel = true;
                }
            }
            return nodes;
        }

        _getFinalDomain(domain) {
            return domain;
        }

        _getOperatorTitle() {
            return {
                '&': this.env._t("All"),
                '|': this.env._t("Any"),
                '!': this.env._t("None"),
            }[this.operator];
        }

        _updateDomain(nodes, operator, valid = null) {
            const amountOfOperators = nodes.length - 1;
            const domain = nodes.reduce((acc, node) => [...acc, ...node], []);
            for (let i = 0; i < amountOfOperators; i++) {
                domain.unshift(operator);
            }
            const detail = { domain: this._getFinalDomain(domain) };
            if (valid !== null) {
                detail.valid = valid;
            }
            this.trigger('domain-change', detail);
        }

        _addChild(index, node) {
            const nodes = this.childNodes;

            nodes.splice(index + 1, 0, node);

            this._updateDomain(nodes, this.operator);
        }

        _removeChild(index) {
            const nodes = this.childNodes;

            nodes.splice(index, 1);

            this._updateDomain(nodes, this.operator);
        }

        //---------------------------------------------------------------------
        // Handlers
        //---------------------------------------------------------------------

        _onAddBranch(index) {
            this._addChild(index, [
                this.operator === "&" ? "|" : "&",
                DEFAULT_DOMAIN,
                DEFAULT_DOMAIN,
            ]);
        }

        _onAddNode(index) {
            this._addChild(index, [DEFAULT_DOMAIN]);
        }

        _onDeleteNode(index) {
            this._removeChild(index);
        }

        _onDomainChange(index, ev) {
            const nodes = this.childNodes;

            nodes.splice(index, 1, ev.detail.domain);

            this._updateDomain(nodes, this.operator, ev.detail.valid);
        }

        _onOperatorChange(ev) {
            const operator = ev.detail.item.value;
            const nodes = this.childNodes;
            for (const node of nodes) {
                const firstOperator = node.find(x => !Array.isArray(x));
                if (!firstOperator) {
                    continue;
                }
                let endIndex = node.findIndex(
                    x => !Array.isArray(x) && x !== firstOperator
                );
                if (endIndex === -1) {
                    endIndex = node.length;
                }
                for (let i = 0; i < endIndex; i++) {
                    if (!Array.isArray(node[i])) {
                        node[i] = operator;
                    }
                }
            }
            this._updateDomain(nodes, operator);
        }
    }
    DomainTree.components = { DomainLeaf, DomainTree, DropdownMenu };
    DomainTree.props = Object.assign({}, AbstractDomainNode.props, {
        previousOp: String,
    });
    DomainTree.template = 'web.DomainTree';

    class DomainSelector extends DomainTree {

        constructor() {
            super(...arguments);
            this.debugInputRef = useRef('debug-input');
        }

        async willUpdateProps(nextProps) {
            await super.willUpdateProps(...arguments);
            this.debugInputRef.el.value = nextProps.domain;
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        _setupDomain(newProps) {
            const { domain, forceCodeEditor } = Object.assign({}, this.props, newProps);
            if (domain !== this.domain) {
                try {
                    const normalizedDomain = pyUtils.normalizeDomain(domain);
                    const domainArray = Domain.prototype.stringToArray(normalizedDomain);
                    if (domainArray.length <= 1) {
                        domainArray.unshift('&');
                    }
                    this.domain = domainArray;
                } catch (err) {
                    this.trigger('domain-change', { domain, valid: false });
                }
                this.operator = this.domain[0];
                this.childNodes = this._getChildNodes();
            }
            this.debug = forceCodeEditor || this.env.isDebug();
        }

        _getFinalDomain(domain) {
            const stringDomain = Domain.prototype.arrayToString(domain);
            return pyUtils.normalizeDomain(stringDomain);
        }

        //---------------------------------------------------------------------
        // Handlers
        //---------------------------------------------------------------------

        async _onDebugInputChange(ev) {
            try {
                const domain = pyUtils.normalizeDomain(ev.target.value);
                this.trigger('domain-change', { domain, valid: true });
            } catch (err) {
                this.env.services.notification.notify({
                    title: this.env._t("Syntax error"),
                    message: this.env._t("The domain you entered is not properly formed"),
                    type: 'danger',
                });
                this.trigger('domain-change', { domain: ev.target.value, valid: false });
            }
        }
    }
    DomainSelector.defaultProps = Object.assign({}, AbstractDomainNode.defaultProps, {
        forceCodeEditor: false,
    });
    DomainSelector.props = Object.assign({}, AbstractDomainNode.props, {
        domain: String,
        forceCodeEditor: Boolean,
        valid: Boolean,
    });
    DomainSelector.template = 'web.DomainSelector';

    return DomainSelector;
});
