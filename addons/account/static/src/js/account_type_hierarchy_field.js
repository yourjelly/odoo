odoo.define('account.AccountTypeHierarchyField', function (require) {
    "use strict";

    const core = require('web.core');
    const qweb = core.qweb;
    const _t = core._t;
    const relational_fields = require('web.relational_fields');
    const field_registry = require('web.field_registry');
    const FieldSelection = relational_fields.FieldSelection;

    const ACCOUNT_TYPE_HIERARCHY = [
        ['equity',                  _t("Equity"), [
            ['equity',                  _t("Equity")],
            ['current_year_earnings',       _t("Current Year Earnings")],
        ]],
        ['asset',                   _t("Assets"), [
            ['current_assets',          _t("Current Assets"), [
                ['liquidity',               _t("Bank and Cash")],
                ['prepayments',             _t("Prepayments")],
                ['receivable',              _t("Receivable")],
            ]],
            ['non_current_assets',  _t("Non Current Assets"), [
                ['fixed_assets',        _t("Fixed Assets")],
            ]],
        ]],
        ['liability',               _t("Liabilities"), [
            ['payable',                 _t("Payable")],
            ['current_liabilities',     _t("Current Liabilities")],
            ['non_current_liabilities', _t("Non-Current Liabilities")],
            ['credit_card',             _t("Credit Card")],
        ]],
        ['income',                  _t("Income"), [
            ['revenue',                 _t("Revenue")],
            ['other_income',            _t("Other Income")],
        ]],
        ['expense',                 _t("Expense"), [
            ['expenses',                _t("Expenses")],
            ['depreciation',            _t("Depreciation")],
            ['cost_of_revenue',         _t("Cost of Revenue")],
        ]],
        ['off_balance',             _t("Off Balance")],
    ];

    var AccountTypeHierarchyField = FieldSelection.extend({

        /**
         * Build the multi-level account type hierarchy based on ACCOUNT_TYPE_HIERARCHY as a "select" widget.
         * @private
         * @param {jQuery} element:                 parent jquery element on which append the newly created <option/>.
         * @param {Array} hierarchyNode:            A node inside ACCOUNT_TYPE_HIERARCHY as a list.
         * @param {Array} cumulatedAccountTypes:    The list of currently traveled account types.
         * @param {Boolean} isRoot:                 A flag allowing the creation of the <optgroup/> since putting an
         *                                          <optgroup/> inside another one is currently not working.
         *                                          A disabled <option/> will be created instead.
         */
        _renderAccountTypeHierarchy: function(element, hierarchyNode, cumulatedAccountTypes, isRoot){
            var self = this;
            var childrenNodes = hierarchyNode[2] || [];
            var level = cumulatedAccountTypes.length;
            var label = $('<div/>').html('&nbsp;'.repeat(6 * level) + hierarchyNode[1]).text();
            var accountTypes = cumulatedAccountTypes.concat([hierarchyNode[0]]);

            if(childrenNodes.length == 0){
                // Leaf node.
                element.append($('<option/>', {
                    value: JSON.stringify(accountTypes.join(',')),
                    text: label,
                }));
            }else{
                // Sub-Tree of options.
                var parentElement;
                if(isRoot){
                    var subElement = $('<optgroup/>', {label: label});
                    element.append(subElement);
                    parentElement = subElement;
                }else{
                    // Putting an <optgroup/> inside another one is currently not working.
                    var subElement = $('<option/>', {text: label, disabled: true});
                    element.append(subElement);
                    parentElement = element;
                }

                _.each(childrenNodes, function(childNode){
                    self._renderAccountTypeHierarchy(parentElement, childNode, accountTypes, false);
                });
            }
        },

        /**
         * @Override
         * Shadow completely the rendering to display the account type hierarchy with multiple levels.
         */
        _renderEdit: function(){
            var self = this;

            // Display the hierarchy of codes.
            this.$el.empty();
            _.each(ACCOUNT_TYPE_HIERARCHY, function(hierarchyNode){
                self._renderAccountTypeHierarchy(self.$el, hierarchyNode, [], true);
            });

            // Format displayed value.
            this.$el.val(JSON.stringify(this.value));

            // Trim select content. Can't be done with CSS styling since <select/> is quite buggy because it works or
            // not depending the current browser.
            var selectedOption = this.$el.find('option:selected')[0];
            if(selectedOption)
                selectedOption.text = selectedOption.text.trim();
        },

    });

    field_registry.add('account_type_hierarchy_field', AccountTypeHierarchyField);
});
