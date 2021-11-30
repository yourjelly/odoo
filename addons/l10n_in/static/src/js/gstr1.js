odoo.define('l10n_in.gstr1', function (require) {
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
                sections: {
                    invoice_section: {
                        columns: [
                            { string: 'Type of Invoice' },
                            { string: 'Count of Documents' },
                            { string: 'Taxable Amount(A)(₹)' },
                            { string: 'Tax Amount(B)(₹)' },
                            { string: 'Invoice Value(₹)'},
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: '<strong>B2B</strong> <span class="text-muted">(4A, 4B, 4C, 6B, 6C)</span>', type: 'html'},
                                    { value: 1 },
                                    { value: 100 },
                                    { value: 10 },
                                    { value: 110 }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>B2C Large</strong> <span class="text-muted">(5A, 5B)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Credit/Debit Notes(Registered)</strong> <span class="text-muted">(9B)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Credit/Debit Notes(Unregistered)</strong> <span class="text-muted">(9B)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Export Invoices</strong> <span class="text-muted">(6A)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },
                    other_section: {
                        columns: [
                            { string: 'Type of Invoice' },
                            { string: 'Taxable Amount(A)(₹)' },
                            { string: 'Tax Amount(B)(₹)' },
                            { string: 'Invoice Value' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: '<strong>B2C Others</strong> <span class="text-muted">(7)</span>', type: 'html' },
                                    { value: 100 },
                                    { value: 10 },
                                    { value: 110 }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Nill Rated Supplies</strong> <span class="text-muted">(8A, 8B, 8C, 8D)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Advances Received(Tax Liability)</strong> <span class="text-muted">(11A(1), 11A(2))</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Adjustment of Advances</strong> <span class="text-muted">(11B(1), 11B(2))</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>HSN summary of outward supplies</strong> <span class="text-muted">(12)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Documents Series Summary</strong> <span class="text-muted">(13)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },
                    amendments_section: {
                        columns: [
                            { string: 'Type of Invoice' },
                            { string: 'Count of Documents' },
                            { string: 'Taxable Amount(A)(₹)' },
                            { string: 'Tax Amount(B)(₹)' },
                            { string: 'Invoice Value' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: '<strong>B2B Amendments</strong> <span class="text-muted">(9A)</span>', type: 'html' },
                                    { value: 1 },
                                    { value: 100 },
                                    { value: 10 },
                                    { value: 110 }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>B2C Large Amendments</strong> <span class="text-muted">(9A)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Credit/Debit Notes(Registered) Amendments</strong> <span class="text-muted">(9C)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Credit/Debit Notes(Unregistered) Amendments</strong> <span class="text-muted">(9C)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Export Invoices Amendments</strong> <span class="text-muted">(9A)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>B2C Others Amendments</strong> <span class="text-muted">(10)</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Advances Received(Tax Liability) Amendments</strong> <span class="text-muted">(11(2))</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: '<strong>Adjustment of Advances Amendments</strong> <span class="text-muted">(11(2))</span>', type: 'html' },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" }
                                ],
                                row_domain: [[]],
                            },
                        ]
                    },
                },
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
            this.renderButtons();
            this.controlPanelProps.cp_content = {
                $buttons: this.$buttons,
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
            this.$searchview_buttons = $(QWeb.render("search_template", { widget: this }));
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
            this.$(".o_content").html($(QWeb.render('GSTR1', { widget: this })));
            this.render_searchview_buttons();
        },
        renderButtons() {
            this.$buttons = $(QWeb.render("gstr1.buttons"));
            const generateJsonButton = this.$buttons.filter('.o_gstr1_generate_json');
            generateJsonButton[0].addEventListener("click", () => {
                // this.$buttons.attr('disabled', true);
                console.log("call server method to generate json");
            });
            return this.$buttons;
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

    core.action_registry.add('account_report_gstr1', gstrWidget);
});
