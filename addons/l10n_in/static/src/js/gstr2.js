odoo.define('l10n_in.gstr2', function (require) {
    'use strict';

    const core = require('web.core');
    const AbstractAction = require('web.AbstractAction');

    const QWeb = core.qweb;
    const _t = core._t;

    const gstrWidget = AbstractAction.extend({
        hasControlPanel: true,
        events: {
            'click .o_open_move_list': 'openMoveList',
        },

        init(parent, action) {
            this.actionManager = parent;
            this.odoo_context = action.context;
            this.data = {
                filters: {
                    journals: [],
                    fiscal_periods: [],
                    active_fiscal_period_filter: 1,
                    active_journal_filters: [1]
                },
                sections: [
                    {
                        section_title: 'Summary Of Supplies From Registered Suppliers B2B(3)',
                        columns: [
                            { string: 'No. of Suppliers' },
                            { string: 'No. if Invoices' },
                            { string: 'Total Invoice Value' },
                            { string: 'Total Taxable Value' },
                            { string: 'Total Integrated Tax Paid'},
                            { string: 'Total Central Tax Paid' },
                            { string: 'Total TState/UT Tax Paid' },
                            { string: 'Total Cess' },
                            { string: 'Total Availed ITC Integrated Tax' },
                            { string: 'Total Availed ITC Central Tax' },
                            { string: 'Total Availed ITC State/UT Tax' },
                            { string: 'Total Availed ITC Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary Of Supplies From Unregistered Suppliers B2BUR(4B)',
                        columns: [
                            { string: 'No. of Invoices (Of Reg Recipient)' },
                            { string: 'Total Invoice Value' },
                            { string: 'Total Taxable Value' },
                            { string: 'Total Integrated Tax Paid' },
                            { string: 'Total Central Tax Paid' },
                            { string: 'Total TState/UT Tax Paid' },
                            { string: 'Total Cess Paid' },
                            { string: 'Total Availed ITC Integrated Tax' },
                            { string: 'Total Availed ITC Central Tax' },
                            { string: 'Total Availed ITC State/UT Tax' },
                            { string: 'Total Availed ITC Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary For IMPS (4C)',
                        columns: [
                            { string: 'No. of Invoices (Of Reg Recipient)' },
                            { string: 'Total Invoice Value' },
                            { string: 'Total Taxable Value' },
                            { string: 'Total Integrated Tax Paid' },
                            { string: 'Total Cess Paid' },
                            { string: 'Total Availed ITC Integrated Tax  ' },
                            { string: 'Total Availed ITC Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary For IMPG (5)',
                        columns: [
                            { string: 'No. of  Bill of Entry' },
                            { string: 'Total Bill of Entry Value' },
                            { string: 'Total Taxable Value' },
                            { string: 'Total Integrated Tax Paid' },
                            { string: 'Total Cess Paid' },
                            { string: 'Total Availed ITC Integrated Tax' },
                            { string: 'Total Availed ITC Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary For CDNR(6C)',
                        columns: [
                            { string: 'No. of Supplier' },
                            { string: 'No. of Notes/Vouchers' },
                            { string: 'No. of Invoices' },
                            { string: 'Total Note/Voucher Value' },
                            { string: 'Total Taxable Value' },
                            { string: 'Total Integrated Tax Paid' },
                            { string: 'Total Central Tax Paid' },
                            { string: 'Total TState/UT Tax Paid' },
                            { string: 'Total Cess' },
                            { string: 'Total Availed ITC Integrated Tax' },
                            { string: 'Total Availed ITC Central Tax' },
                            { string: 'Total Availed ITC State/UT Tax' },
                            { string: 'Total Availed ITC Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary For CDNUR(6C)',
                        columns: [
                            { string: 'No of Notes/Vouchers' },
                            { string: 'No. of Invoices' },
                            { string: 'Total Note/Refund Voucher Value' },
                            { string: 'Total Taxable Value' },
                            { string: 'Total Integrated Tax Paid' },
                            { string: 'Total Central Tax Paid' },
                            { string: 'Total TState/UT Tax Paid' },
                            { string: 'Total Cess Paid' },
                            { string: 'Total ITC Integrated Tax Amount' },
                            { string: 'Total Central Tax Amount' },
                            { string: 'Total ITC State/UT Tax Amount' },
                            { string: 'Total ITC Cess Amount' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary For  Tax Liability on Advance Paid  under reverse charge(10 A) ',
                        columns: [
                            { string: 'Total Advance Paid' },
                            { string: 'Total Cess Amount' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary For Adjustment of advance tax paid earlier for reverse charge supplies (10 B)',
                        columns: [
                            { string: 'Total Advance Adjusted' },
                            { string: 'Total Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary For Composition, Nil rated, exempted and non GST inward supplies (7)',
                        columns: [
                            { string: 'Total Composition taxable person' },
                            { string: 'Total Nil Rated Supplies' },
                            { string: 'Total Exempted Supplies' },
                            { string: 'Total Non-GST Supplies' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary Input Tax credit Reversal/ Reclaim(11)',
                        columns: [
                            { string: 'Total ITC Integrated Tax Amount' },
                            { string: 'Total Central Tax Amount' },
                            { string: 'Total ITC State/UT Tax Amount' },
                            { string: 'Total ITC Cess Amount' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },

                    {
                        section_title: 'Summary For HSN(13)',
                        columns: [
                            { string: 'No. of HSN' },
                            { string: 'Total Value' },
                            { string: 'Total Taxable Value' },
                            { string: 'Total Integrated Tax' },
                            { string: 'Total Central Tax' },
                            { string: 'Total State/UT Tax' },
                            { string: 'Total Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },
                ],
            };
            return this._super(...arguments);
        },
        /**
         * @override
         */
        async willStart() {
            const prom = this._super(...arguments);
            await this.getGSTR1Data();
            return Promise.all([prom, this.generateSearchView()]);
        },
        /**
         * @override
         */
        async start() {
            this.controlPanelProps.cp_content = {
                // $buttons: this.$buttons,
                $searchview_buttons: this.$searchview_buttons,
                // $pager: this.$pager,
                $searchview: this.$searchview,
            };
            await this._super(...arguments);
            this.render();
        },

        //-------------------------------------------------------------------------
        // Public
        //-------------------------------------------------------------------------

        /**
         * Generates search view by rendering search template
         *
         */
        generateSearchView() {
            this.$searchview_buttons = $(QWeb.render("gstr2_search_template", { widget: this }));
            return Promise.resolve();
        },

        async getGSTR1Data() {
            // TODO: MSH: We will call only one single method to get all datas
            this.data.filters.journals = await this._rpc({
                model: 'account.journal',
                method: 'search_read',
                fields: ["id", "name", "code"],
                domain: [['type', '=', 'sale']],
                context: this.odoo_context,
            });

            this.data.filters.fiscal_periods = await this._rpc({
                model: 'account.fiscal.year',
                method: 'search_read',
                fields: ["id", "name"],
                domain: [],
                context: this.odoo_context,
            });
        },
        /**
         * Prepares string to disp[lay on Jorunal filter based on active Journals
         */
        getActiveJournals() {
            let selectedJournals = [];
            this.data.filters.active_journal_filters.forEach(id => {
                const journal = this.data.filters.journals.find((journal) => journal.id === id);
                selectedJournals.push(journal.name);
            });
            return selectedJournals.join(", ");
        },
        getActivePeriod() {
            return this.data.filters.fiscal_periods.find((period) => period.id === this.data.filters.active_fiscal_period_filter);
        },
        reload: function () {
            // TODO: MSH: On filter change get data again and re-render this view again

            // return this._rpc({
            //     model: ModelName,
            //     method: 'MethodName',
            //     args: [ArgsIfNeeded],
            //     context: self.odoo_context,
            // })
            return Promise.resolve()
                .then((result) => {
                    // TODO: Update current data in this and call rerenderView
                    return this.rerenderView();
                });
        },
        render() {
            this.$(".o_content").html($(QWeb.render('GSTR2', { widget: this })));
            this.render_searchview_buttons();
        },
        rerenderView() {
            this.render();
            this.render_searchview_buttons();
            return this.update_cp();
        },
        /**
         * Apply decoration classes on search view buttons and bind some events on search view buttons
         *
         */
        render_searchview_buttons() {
            this.$searchview_buttons.find('.js_gstr_date_filter').each((index, filter) => {
                $(filter).toggleClass('selected', this.data.filters.active_fiscal_period_filter === $(filter).data('id'));
            });

            this.$searchview_buttons.find('.js_gstr_journal_filter').each((index, filter) => {
                $(filter).toggleClass('selected', this.data.filters.active_journal_filters.includes($(filter).data('id')));
            });

            this.$searchview_buttons.find('.js_gstr_fiscal_period_filter').click(this.onClickPeriod.bind(this));
            this.$searchview_buttons.find('.js_gstr_journal_filter').click(this.onClickJournal.bind(this));
        },
        update_cp() {
            this.renderButtons();
            const status = {
                cp_content: {
                    $buttons: this.$buttons,
                    $searchview_buttons: this.$searchview_buttons,
                    // $pager: this.$pager,
                    $searchview: this.$searchview,
                },
            };
            return this.updateControlPanel(status);
        },

        //-------------------------------------------------------------------------
        // Handlers
        //-------------------------------------------------------------------------

        /**
         * When Journal is changed, filter data based on given journal and re-render view
         * @param {MouseEvent} ev
         */
        onClickJournal(ev) {
            // Only re-render if filters are changed, i.e. if there are any changes in filter
            // TODO: MSH: Fetch new data based on given filters and re-render view
            // i.e. we need to call renderElement explicilty
            console.log("Inside onClickJournal");
            this.reload();
        },
        /**
         * When Period is changed, filter data based on given period and re-render view
         * @param {MouseEvent} ev
         */
        onClickPeriod(ev) {
            // Only re-render if filters are changed, i.e. if there are any changes in filter
            // TODO: MSH: Fetch new data based on given filters and re-render view
            // i.e. we need to call renderElement explicilty
            console.log("Inside onClickPeriod");
            this.reload();
        },
        /**
         * Opens list view of account.move
         * @param {MouseEvent} ev
         */
        openMoveList(ev) {
            this.do_action({
                name: "Journal Entries",
                res_model: 'account.move',
                type: "ir.actions.act_window",
                views: [[false, "list"], [false, "kanban"], [false, "form"]],
                view_mode: "form",
            });
        }
    });

    core.action_registry.add('account_report_gstr2', gstrWidget);
});
