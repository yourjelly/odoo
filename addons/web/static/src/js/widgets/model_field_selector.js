odoo.define("web.ModelFieldSelector", function (require) {
    "use strict";

    const { useAutofocus } = require('web.custom_hooks');
    require('web.web_client'); // TODO(jum): find a better way to use env.bus

    const { Component, hooks } = owl;
    const { useExternalListener, useRef, useState } = hooks;

    /**
     * Allow to transform a mapping field name -> field info in an array of the
     * field infos, sorted by field user name ("string" value). The field infos in
     * the final array contain an additional key "name" with the field name.
     * @param {Object} fields the mapping field name -> field info
     * @param {string} model
     * @returns {Object[]} the field infos sorted by field[this.props.order]
     *      (field infos contain additional keys "model" and "name" with the
     *      field name).
     */
    function sortFields(fields, model, order) {
        return Object.entries(fields)
            .map(([name, field]) =>
                Object.assign({ name, model }, field)
            )
            .sort((a, b) =>
                a[order] > b[order] ? 1 : a[order] < b[order] ? -1 : 0
            );
    }

    /**
     * The ModelFieldSelector widget can be used to display/select a particular
     * field chain from a given model.
     */
    class ModelFieldSelector extends Component {
        /**
         * The ModelFieldSelector requires a model and a field chain to work with.
         *
         * @param {string} model - the model name (ev.g. "res.partner")
         * @param {string[]} chain - list of the initial field chain parts
         * @param {Object} [props] - some key-value props
         * @param {string} [props.order='string']
         *                 an ordering key for displayed fields
         * @param {boolean} [props.readonly=true] - true if should be readonly
         * @param {function} [props.filter]
         *                 a function to filter the fetched fields
         * @param {Object} [props.filters]
         *                 some key-value props to filter the fetched fields
         * @param {boolean} [props.filters.searchable=true]
         *                  true if only the searchable fields have to be used
         * @param {Object[]} [props.fields=null]
         *                   the list of fields info to use when no relation has
         *                   been followed (null indicates the widget has to request
         *                   the fields itself)
         * @param {boolean|function} [props.followRelations=true]
         *                  true if can follow relation when building the chain
         * @param {boolean} [props.showSearchInput=true]
         *                  false to hide a search input to filter displayed fields
         */
        constructor() {
            super(...arguments);

            this.props.filters = Object.assign({
                searchable: true,
            }, this.props.filters);

            this.dirty = false;

            useDebug({ accessKey: 'mf' });
            this.state = useState({
                chain: this.props.chain,
                lineFocus: 0,
                open: false,
                pages: [],
                searchValue: "",
                valid: true,
            });

            this.pageRef = useRef('page');
            this.searchInputRef = useRef('search-input');

            useAutofocus();
            useExternalListener(window, 'click', this._onWindowClick);
        }

        async willStart() {
            await this._pushPageData(this.props.model);
            if (this.state.chain.length) {
                await this._processChain(this.state.chain.slice().reverse());
            }
        }

        async willUpdateProps(newProps) {
            const props = Object.assign({}, this.props, newProps);
            this.state.chain = props.chain;
            if (this.state.chain.length) {
                await this._processChain(this.state.chain.slice().reverse());
            }
        }

        //---------------------------------------------------------------------
        // Getters
        //---------------------------------------------------------------------

        get lines() {
            const lines = this.state.pages[this.state.pages.length - 1].filter(this.props.filter);
            if (this.state.searchValue) {
                const matches = fuzzy.filter(this.state.searchValue, lines.map(l => l.string));
                return matches.map(m => lines[m.index]);
            } else {
                return lines;
            }
        }

        get title() {
            let title = "";
            if (this.state.pages.length > 1) {
                const comaprison = this.state.chain.length === this.state.pages.length ?
                    this.state.chain[this.state.chain.length - 2] :
                    this.state.chain[this.state.chain.length - 1];
                const prevField = this.state.pages[this.state.pages.length - 2].find(p => p.name === comaprison);
                if (prevField) {
                    title = prevField.string;
                }
            }
            return title;
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        /**
         * @private
         * @param {string} name
         * @param {number} index
         */
        _getFieldsInfo(name, index) {
            if (['0', '1'].includes(name)) {
                return name;
            }
            const page = this.state.pages[index];
            if (page) {
                const fieldInfo = page.find(f => f.name === name);
                if (fieldInfo && fieldInfo.string) {
                    return fieldInfo.string;
                }
            }
            return "?";
        }

        /**
         * Adds a field name to the current field chain and marks it as dirty.
         *
         * @private
         * @param {string} fieldName - the new field name to add at the end of the
         *                           current field chain
         */
        _addChainNode(fieldName) {
            this.dirty = true;
            this.state.chain = this.state.chain.slice(0, this.state.pages.length - 1);
            this.state.chain.push(fieldName);
            this.state.searchValue = "";
        }

        /**
         * Check whether a line is able to follow a relation.
         * @private
         * @param {Object} line
         */
        _hasRelations(line) {
            let followRelations;
            if (this.props.followRelations instanceof Function) {
                followRelations = this.props.followRelations(...arguments);
            } else {
                followRelations = Boolean(this.props.followRelations);
            }
            return followRelations && line.relation;
        }

        /**
         * Search a field in the last page by its name.
         * @private
         * @param {string} name - the name of the field to find
         * @returns {Object} the field data found in the last popover page thanks
         *                   to its name
         /*/
        _getLastPageField(name) {
            return this.state.pages[this.state.pages.length - 1].find(f => f.name === name);
        }

        /**
         * Add a new page to the popover following the given field relation and
         * adapts the chain node according to this given field.
         * @private
         * @param {Object} field - the field to add to the chain node
         */
        async _goToNextPage(field) {
            this.state.lineFocus = 0;
            this.state.valid = true;
            this._addChainNode(field.name);
            await this._pushPageData(field.relation);
            console.log({ chain: this.state.chain, pages: this.state.pages });
        }

        /**
         * Remove the last page, adapts the field chain and displays the new
         * last page.
         * @private
         */
        _goToPrevPage() {
            if (!this.state.pages.length) {
                return;
            }
            this.state.lineFocus = 0;
            this.state.valid = true;
            this._removeChainNode();
            if (this.state.pages.length > 1) {
                this.state.pages.pop();
            }
            console.log({ chain: this.state.chain, pages: this.state.pages });
        }

        /**
         * If open: close the popover and marks the field as selected and notify
         * its parents if the field chain changed.
         * @private
         */
        _closePopover() {
            if (!this.state.open) {
                return;
            }
            this.state.open = false;
            this.state.lineFocus = 0;
            console.log({ chain: this.state.chain, pages: this.state.pages });
            if (this.dirty) {
                this.dirty = false;
                const index = this.state.chain.length - 1;
                const fieldName = this.state.chain[index];
                const field = this.lines.find(l => l.name === fieldName);
                this.state.valid = Boolean(field);
                this.trigger('field-chain-changed', { chain: this.state.chain, field });
            }
        }

        /**
         * @private
         * @param {string[]} chain
         */
        async _processChain(chain) {
            const fieldName = chain.pop();
            const field = this._getLastPageField(fieldName);
            if (field && field.relation) { // Fetch next chain node if any and possible
                await this._pushPageData(field.relation);
                if (chain.length) {
                    return this._processChain(chain);
                }
            } else if (field && chain.length === 0) { // Last node fetched
                return;
            } else if (!field && ['0', '1'].includes(fieldName)) { // TRUE_LEAF or FALSE_LEAF
                this.state.valid = true;
            } else { // Wrong node chain
                this.state.valid = false;
            }
        }

        /**
         * Get the fields of a particular model and add them to a new last
         * popover page.
         * @private
         * @param {string} model - the model name whose fields have to be fetched
         * @returns {Promise} resolved once the fields have been added
         */
        async _pushPageData(model) {
            let fields;
            if (this.props.model === model && this.props.fields) {
                fields = sortFields(this.props.fields, model, this.props.order);
            } else {
                fields = await this.constructor.getModelFields(model, this.rpc.bind(this), {
                    context: this.env.session.user_context,
                    filters: this.props.filters,
                    filterFn: this.props.filter,
                    orderBy: this.props.order,
                });
            }
            this.state.pages.push(fields);
        }

        /**
         * Remove the last field name at the end of the current field chain and
         * mark it as dirty.
         * @private
         */
        _removeChainNode() {
            this.dirty = true;
            this.state.chain = this.state.chain.slice(0, this.state.pages.length - 1);
            this.state.chain.pop();
        }

        /**
         * Select the given field and adapt the chain node according to it.
         * It also closes the popover and so notifies the parents about the change.
         * @private
         * @param {Object} field - the field to select
         */
        _selectField(field) {
            this._addChainNode(field.name);
            this._closePopover();
        }

        //---------------------------------------------------------------------
        // Handlers
        //---------------------------------------------------------------------

        /**
         * Add a field to the chain and follow its relation if possible.
         * @private
         * @param {Object} line
         * @param {MouseEvent} ev
         */
        _onLineClick(line, ev) {
            if (this._hasRelations(line)) {
                ev.stopPropagation();
                this._goToNextPage(this._getLastPageField(line.name));
            } else {
                this._selectField(this._getLastPageField(line.name));
            }
        }

        /**
         * Adapt the chain on debug input change.
         */
        async _onDebugInputChange(ev) {
            this.state.chain = ev.target.value.split(".");
            this.dirty = true;
            if (!this.props.followRelations && this.state.chain.length > 1) {
                this.do_warn(
                    this.env._t("Relation not allowed"),
                    this.env._t("You cannot follow relations for this field chain construction")
                );
                this.state.chain = this.state.chain.slice(0, 1);
            }
            this._closePopover();
        }

        /**
         * Handle keyboard navigation.
         * @private
         * @param {KeyboardEvent} ev
         */
        _onKeydown(ev) {
            if (!this.state.open) {
                this.state.open = ev.key === 'Enter';
                return;
            }
            const isInputFocused = ev.target.tagName === 'INPUT';
            const scrollToLine = () => {
                const line = this.pageRef.el.querySelectorAll('.o_field_selector_item')[this.state.lineFocus];
                line.scrollIntoView({ block: 'center' });
            };

            switch (ev.key) {
                case 'ArrowUp':
                    ev.preventDefault();
                    this.state.lineFocus = Math.max(this.state.lineFocus - 1, 0);
                    scrollToLine();
                    break;
                case 'ArrowDown':
                    ev.preventDefault();
                    this.state.lineFocus = Math.min(this.state.lineFocus + 1, this.lines.length - 1);
                    scrollToLine();
                    break;
                case 'ArrowLeft':
                    if (isInputFocused && ev.target.selectionStart > 0) {
                        break;
                    }
                    ev.preventDefault();
                    this._goToPrevPage();
                    break;
                case 'Escape':
                    ev.stopPropagation();
                    this._closePopover();
                    break;
                case 'ArrowRight':
                    if (isInputFocused && ev.target.selectionStart < ev.target.value.length) {
                        break;
                    }
                    const field = this.lines[this.state.lineFocus];
                    if (field.relation) {
                        this._goToNextPage(field);
                        break;
                    }
                /* falls through */
                case 'Enter':
                    if (isInputFocused) {
                        break;
                    }
                    const { name } = this.lines[this.state.lineFocus];
                    this._selectField(this._getLastPageField(name));
                    break;
            }
        }

        /**
         * @private
         * @param {MouseEvent} ev
         */
        _onWindowClick(ev) {
            if (!this.el.contains(ev.target)) {
                this._closePopover();
            }
        }

        //---------------------------------------------------------------------
        // Static
        //---------------------------------------------------------------------

        /**
         * Search the cache for the given model fields, according to the given
         * filter. If the cache does not know about the model, it is updated.
         * @static
         * @param {string} model
         * @param {Function} rpc
         * @param {Object} [params={}]
         * @param {Object} [params.context={}]
         * @param {Function} [params.filterFnmodel=f(true)]
         * @param {Object} [params.filters={searchable:true}]
         * @param {string} [params.orderBy='string']
         * @returns {Object[]} a list of the model fields info, sorted by field
         *                     non-technical names
         */
        static async getModelFields(model, rpc, params = {}) {
            params = Object.assign({
                context: {},
                filterFn: () => true,
                filters: { searchable: true },
                orderBy: 'string',
            }, params);
            if (!this.cache[model]) {
                console.log(`Fetching fields for model "${model}" from server.`);
                if (!this.fetching[model]) {
                    this.fetching[model] = rpc({
                        args: [
                            false,
                            ["store", "searchable", "type", "string", "relation", "selection", "related"],
                        ],
                        model: model,
                        method: 'fields_get',
                        context: params.context,
                    });
                }
                const fields = await this.fetching[model];
                this.cache[model] = sortFields(fields, model, params.orderBy);
            } else {
                console.log(`Getting fields for model "${model}" from cache.`);
            }
            return this.cache[model].filter(
                f => (!params.filters.searchable || f.searchable) && params.filterFn(f)
            );
        }

        /**
         * @static
         * @param {string} initialChain
         * @param {string} model
         * @param {Function} rpc
         */
        static async getField(initialChain, model, rpc) {

            const chain = initialChain.slice();
            const fieldName = chain.shift();
            const fields = await this.getModelFields(model, rpc);
            const field = fields.find(f => f.name === fieldName);
            if (!field || (chain.length && !field.relation)) {
                throw new Error("Invalid chain/model combination");
            }
            return chain.length ? this.getField(chain, field.relation, rpc) : field;
        }
    }

    ModelFieldSelector.cache = {};
    ModelFieldSelector.fetching = {};
    ModelFieldSelector.env.bus.on('clear_cache', null, () => {
        ModelFieldSelector.cache = {};
        ModelFieldSelector.fetching = {};
    });

    ModelFieldSelector.defaultProps = {
        filter: i => i,
        filters: {},
        followRelations: true,
        order: 'string',
        readonly: true,
        showSearchInput: true,
    };
    ModelFieldSelector.props = {
        chain: Array,
        fields: { type: Object, optional: 1 },
        filter: Function,
        filters: Object,
        followRelations: Boolean,
        model: String,
        order: String,
        readonly: Boolean,
        showSearchInput: Boolean,
    };
    ModelFieldSelector.template = 'web.ModelFieldSelector';

    return ModelFieldSelector;
});
