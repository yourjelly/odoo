odoo.define('stock.ReceptionReport', function (require) {
"use strict";


const clientAction = require('report.client_action');
const core = require('web.core');

const qweb = core.qweb;

const ReceptionReport = clientAction.extend({
    /**
     * @override
     */
    init: function (parent, action, options) {
        this._super.apply(this, arguments);
        this.context = Object.assign(action.context || {}, {
            active_ids: action.context.default_picking_ids,
        });
        this.report_name = `stock.report_reception`
        this.report_url = `/report/html/${this.report_name}/?context=${JSON.stringify(this.context)}`;
        this._title = action.name;
    },

    /**
     * @override
     */
     start: function () {
        return Promise.all([
            this._super(...arguments),
        ]).then(() => {
            this._renderButtons();
        });
    },

    /**
     * @override
     */
    on_attach_callback: function () {
        this._super();
        this.iframe.addEventListener("load",
            () => this._bindAdditionalActionHandlers(),
            { once: true }
        );
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Renders extra report buttons in control panel
     */
     _renderButtons: function () {
        this.$buttons.append(qweb.render('reception_report_buttons', {}));
        this.$buttons.on('click', '.o_report_reception_assign', this._onClickAssign.bind(this));
        this.$buttons.on('click', '.o_print_label', this._onClickPrintLabel.bind(this));
        this.controlPanelProps.cp_content = {
            $buttons: this.$buttons,
        };
    },

    /**
     * Bind additional <button> action handlers
     */
    _bindAdditionalActionHandlers: function () {
        let rr = $(this.iframe).contents().find('.o_report_reception');
        rr.on('click', '.o_report_reception_assign', this._onClickAssign.bind(this));
        rr.on('click', '.o_report_reception_unassign', this._onClickUnassign.bind(this));
        rr.on('click', '.o_report_reception_forecasted', this._onClickForecastReport.bind(this));
        rr.on('click', '.o_print_label', this._onClickPrintLabel.bind(this));
    },


    _switchButton: function(button) {
        if (button.innerText.includes('Unassign')) {
            button.innerText = "Assign";
            button.classList.add("o_report_reception_assign");
            button.classList.remove("o_report_reception_unassign");
        } else {
            button.innerText = "Unassign";
            button.classList.add("o_report_reception_unassign");
            button.classList.remove("o_report_reception_assign");
        }
    },

    /**
     * Assign the specified move(s)
     *
     * @returns {Promise}
     */
    _onClickAssign: function(ev) {
        let quantities = [];  // incoming qty amounts to assign
        let moveIds = [];
        let inIds = [];
        let nodeToAssign = []
        if (! ev.currentTarget.className.includes('o_assign_all')) {
            nodeToAssign = [ev.currentTarget];
            ev.target.closest('tbody').previousElementSibling.querySelectorAll('.o_print_label_all').forEach(button => button.removeAttribute('disabled'));
        } else {
            ev.target.style.display = 'none';
            if (ev.target.name === "assign_all_link") {
                this.iframe.contentDocument.querySelectorAll('.o_assign_all').forEach(b => b.style.display = 'none');
                this.iframe.contentDocument.querySelectorAll('.o_print_label_all').forEach(button => button.removeAttribute('disabled'));
                nodeToAssign = this.iframe.contentDocument.querySelectorAll('.o_report_reception_assign:not(.o_assign_all)');
            } else {
                // Local assign all
                nodeToAssign = ev.target.closest('thead').nextElementSibling.querySelectorAll('.o_report_reception_assign:not(.o_assign_all)');
                ev.target.closest('thead').nextElementSibling.querySelectorAll('.o_print_label_all').forEach(button => button.removeAttribute('disabled'));
            }
        }
        nodeToAssign.forEach(node => {
            node.closest('td').nextElementSibling.querySelectorAll('.o_print_label').forEach(button => button.removeAttribute('disabled'));
            moveIds.push(parseInt(node.getAttribute('move-id')));
            quantities.push(parseFloat(node.getAttribute('qty')));
            inIds.push(JSON.parse(node.getAttribute('move-ins-ids')));
            this._switchButton(node);
        });

        return this._rpc({
            model: 'report.stock.report_reception',
            args: [false, moveIds, quantities, inIds],
            method: 'action_assign'
        })
    },

    /**
     * Unassign the specified move
     *
     * @returns {Promise}
     */
     _onClickUnassign: function(ev) {
        this._switchButton(ev.currentTarget);
        let quantity = parseFloat(ev.target.getAttribute('qty'));
        let modelId = parseInt(ev.target.getAttribute('move-id'));
        let inIds = JSON.parse("[" + ev.target.getAttribute('move-ins-ids') + "]");
        ev.target.closest('td').nextElementSibling.querySelectorAll('.o_print_label').forEach(button => button.setAttribute('disabled', true));
        return this._rpc({
            model: 'report.stock.report_reception',
            args: [false, modelId, quantity, inIds[0]],
            method: 'action_unassign'
        })
    },

    /**
     * Open the forecast report for the product of
     * the selected move
     */
    _onClickForecastReport: function(ev) {
        const model = ev.target.getAttribute('model');
        const modelId = parseInt(ev.target.getAttribute('move-id'));
        return this._rpc( {
            model,
            args: [[modelId]],
            method: 'action_product_forecast_report'
        }).then((action) => {
            return this.do_action(action);
        });
    },

    /**
     * Print the corresponding source label
     */
    _onClickPrintLabel: function(ev) {
        // unfortunately, due to different reports needed for different models, we will handle
        // pickings here and others models will have to be extended/printed separately until better
        // technique to merge into continuous pdf to written
        return this._printLabel(ev, 'stock.report_reception_report_label', 'stock.picking')
    },

    _printLabel: function(ev, reportFile, sourceType) {
        let report_file = reportFile
        let modelIds = [];
        let productQtys = [];
        let nodeToPrint = [];

        if (! ev.currentTarget.className.includes('o_print_label_all')) {
            nodeToPrint = [ev.currentTarget];
        } else {
            if (ev.target.name === "print_all_labels") {
                nodeToPrint = this.iframe.contentDocument.querySelectorAll('.o_print_label:not(.o_print_label_all):not(:disabled)');
            } else {
                // Local print all
                nodeToPrint = ev.target.closest('thead').nextElementSibling.querySelectorAll('.o_print_label:not(.o_print_label_all):not(:disabled)');
            }
        }

        nodeToPrint.forEach(node => {
            if (node.getAttribute('source-name') === sourceType) {
                modelIds.push(parseInt(node.getAttribute('source-id')));
                productQtys.push(Math.ceil(node.getAttribute('qty')) || '1');
            }
        });

        if (modelIds.length) {
            let report_name =  report_file + '?docids=' + modelIds +
                '&report_type=' + 'qweb-pdf' +
                '&quantity=' + productQtys.toString();

            var action = {
                'type': 'ir.actions.report',
                'report_type': 'qweb-pdf',
                'report_name': report_name,
                'report_file': report_file,
            };

            return this.do_action(action);
        }
        // nothing to print for this model => print next
        return Promise.resolve();
    }

});

core.action_registry.add('reception_report', ReceptionReport);

return ReceptionReport;

});
