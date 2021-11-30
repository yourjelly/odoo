odoo.define('l10n_in.gstr3b', function (require) {
    'use strict';

    const core = require('web.core');
    const AbstractAction = require('web.AbstractAction');

    const QWeb = core.qweb;
    const _t = core._t;

    const gstr3bWidget = AbstractAction.extend({
        hasControlPanel: true,
        events: {
            'click .o_open_move_list': 'openMoveList',
        },

        init(parent, action) {
            this.actionManager = parent;
            this.odoo_context = action.context;

            // TODO: MSH: Prepare data such a way that we can have total row as well as buttons are also defined here in data
            // we will send buttons on section so those button will be displayed on all row of that section
            // we will send total row separately as we don't want buttons on that row
            // or maybe we will pass no_buttons attribute on row, so on that row buttons will not be displayed

            // TODO: MSH: columns should array of array of object i.e. [[{}, {}], [{}, {}]], as columns can be in two row as well
            // so we should define columns in array of array of object

            // TODO: all reports gstrr1, gstr2, gstr3 has same code, so maybe just create single AbstractAction widget and
            // create three different action in actionRegistry and call with different context or maybe move common code in mixins

            this.data = {
                filters: {
                    journals: [],
                    fiscal_periods: [],
                    active_fiscal_period_filter: 1,
                    active_journal_filters: [1]
                },
                sections: [
                    {
                        section_title: '3.1 Details of Outward Supplies and inward supplies liable to reverse charge',
                        columns: [
                            { string: 'Nature of Supplies' },
                            { string: 'Total Taxable value' },
                            { string: 'Integrated Tax' },
                            { string: 'Central Tax' },
                            { string: 'State/UT Tax'},
                            { string: 'Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "(a) Outward Taxable  supplies  (other than zero rated, nil rated and exempted)" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: "(b) Outward Taxable  supplies  (zero rated )" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: "(c) Other Outward Taxable  supplies (Nil rated, exempted)" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: "(d) Inward supplies (liable to reverse charge)" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: "(e) Non-GST Outward supplies" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ],
                        total_row: [
                            { value: "Total" },
                            { value: "" },
                            { value: "" },
                            { value: "" },
                            { value: "" },
                            { value: "", colspan: 2 },
                        ]
                    },

                    {
                        section_title: '4. Eligible ITC',
                        columns: [
                            { string: 'Details' },
                            { string: 'Integrated Tax' },
                            { string: 'Central Tax' },
                            { string: 'State/UT Tax' },
                            { string: 'Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    {
                                        col_level: 0,
                                        value: "(A) ITC Available (Whether in full or part)",
                                        colspan: 5,
                                    },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    {
                                        col_level: 1,
                                        value: "(1) Import of goods",
                                    },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    {
                                        col_level: 1,
                                        value: "(2) Import of services",
                                    },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    {
                                        col_level: 1,
                                        value: "(3) Inward supplies liable to reverse charge(other than 1 & 2 above)"
                                    },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    {
                                        col_level: 1,
                                        value: "(4) Inward supplies from ISD"
                                    },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    {
                                        col_level: 1,
                                        value: "(5) All other ITC"
                                    },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },

                            {
                                row_data: [
                                    {
                                        col_level: 0,
                                        value: "(B) ITC Reversed",
                                        colspan: 5,
                                    },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    {
                                        col_level: 1,
                                        value: "(1) As per Rule 42 & 43 of SGST/CGST rules "
                                    },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    {
                                        col_level: 1,
                                        value: "(2) Others"
                                    },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },

                            {
                                row_data: [
                                    { value: "(C) Net ITC Available (A)-(B)" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },

                            {
                                row_data: [
                                    {
                                        col_level: 0,
                                        value: "(D) Ineligible ITC",
                                        colspan: 5,
                                    },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    {
                                        col_level: 1,
                                        value: "(1) As per section 17(5) of CGST//SGST Act"
                                    },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    {
                                        col_level: 1,
                                        value: "(2) Others"
                                    },
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
                        section_title: '5. Values of exempt, Nil-rated and non-GST inward supplies',
                        columns: [
                            { string: 'Nature of supplies' },
                            { string: 'Inter-State supplies' },
                            { string: 'Intra-state supplies' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "From a supplier under composition scheme, Exempt  and Nil rated supply" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                            {
                                row_data: [
                                    { value: "Non GST supply" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ],
                        total_row: [
                            { value: "Total" },
                            { value: "" },
                            { value: "", colspan: 2 },
                        ]
                    },

                    {
                        section_title: '5.1 Interest & late fee payable',
                        columns: [
                            { string: 'Description' },
                            { string: 'Integrated Tax' },
                            { string: 'Central Tax' },
                            { string: 'State/UT Tax' },
                            { string: 'Cess' },
                        ],
                        rows: [
                            {
                                row_data: [
                                    { value: "Interest" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                    { value: "" },
                                ],
                                row_domain: [[]],
                            },
                        ],
                        total_row: [
                            { value: "Total" },
                            { value: "" },
                            { value: "" },
                            { value: "" },
                            { value: "" },
                        ]
                    },

                    {
                        section_title: '3.2  Of the supplies shown in 3.1 (a), details of inter-state supplies made to unregistered persons, composition taxable person and UIN holders',
                        columns_lists: [
                            [
                                { string: 'Place of Supply(State/UT)', rowspan: 2 },
                                { string: 'Supplies made to Unregistered Persons', colspan: 2 },
                                { string: 'Supplies made to Composition Taxable Persons', colspan: 2 },
                                { string: 'Supplies made to UIN holders', colspan: 2 },
                            ],
                            [
                                { string: 'Total Taxable value' },
                                { string: 'Amount of Integrated Tax' },
                                { string: 'Total Taxable value' },
                                { string: 'Amount of Integrated Tax' },
                                { string: 'Total Taxable value' },
                                { string: 'Amount of Integrated Tax' },
                            ],
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
                        ],
                        total_row: [
                            { value: "Total" },
                            { value: "" },
                            { value: "" },
                            { value: "" },
                            { value: "" },
                            { value: "" },
                            { value: "" },
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
            this.$(".o_content").html($(QWeb.render('GSTR3B', { widget: this })));
            this.render_searchview_buttons();
        },
        renderButtons() {
            this.$buttons = $(QWeb.render("gstr3.buttons"));
            const generateJsonButton = this.$buttons.filter('.o_gstr3_generate_json');
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

    core.action_registry.add('account_report_gstr3b', gstr3bWidget);
});
