odoo.define('pos_invoice.InvoiceListScreen', function (require) {
    'use strict';

    const IndependentToOrderScreen = require('point_of_sale.IndependentToOrderScreen');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');

    const NUMBER_TYPES = ['monetary', 'int', 'float'];
    let ACCOUNT_MOVE_FIELDS_INFO;

    class InvoiceListScreen extends IndependentToOrderScreen {
        constructor() {
            super(...arguments);
            this.state = owl.hooks.useState({ searchString: '' });
            this.viewInfo = {
                model: 'account.move',
                fieldsToLoad: ['name', 'date', 'partner_id', 'amount_residual'],
                fieldsToShow: ['name', 'date', 'partner_id', 'amount_residual'],
                nPerPage: 20,
                currentPage: 1,
                // computed at every _fetch call
                totalCount: 0,
                // computed at willStart
                fieldInfo: undefined,
            };
            this.invoices = [];
            useListener('close-screen', this.close);
            useListener('search', this._onSearch);
            useListener('clear-search', this._onClearSearch);
            useListener('set-page', this._onSetPage);
            useListener('click-invoice', this._onClickInvoice);
        }
        async willStart() {
            if (!ACCOUNT_MOVE_FIELDS_INFO) {
                ACCOUNT_MOVE_FIELDS_INFO = await this.rpc({
                    model: this.viewInfo.model,
                    method: 'fields_get',
                    args: [this.viewInfo.fieldsToLoad],
                });
            }
            this.viewInfo.fieldsInfo = ACCOUNT_MOVE_FIELDS_INFO;
        }
        mounted() {
            this._onSetPage({ detail: { to: 1 } });
        }
        onInputKeydown(event) {
            if (event.key === 'Enter') {
                this.trigger('search');
            }
        }
        _onSearch() {
            this.viewInfo.currentPage = 1;
            return this._fetch();
        }
        _onClearSearch() {
            this.state.searchString = '';
            this.viewInfo.currentPage = 1;
            return this._fetch();
        }
        _onSetPage(event) {
            let newPage = 0;
            const param = event.detail;
            if (param.increment) {
                newPage = this.viewInfo.currentPage + param.increment;
            } else if (param.to) {
                newPage = param.to;
            }
            this.viewInfo.currentPage = newPage;
            return this._fetch();
        }
        _onClickInvoice(event) {
            this.showScreen('InvoicePaymentScreen', { invoice: event.detail });
        }
        async _fetch() {
            const kwargs = this._getFetchKwargs();
            this.viewInfo.totalCount = await this.rpc({
                method: 'search_count',
                model: this.viewInfo.model,
                args: [kwargs.domain],
            });
            const invoices = await this.rpc({
                method: 'search_read',
                model: this.viewInfo.model,
                kwargs,
            });
            this.invoices = invoices;
            this.render();
        }
        _getFetchKwargs() {
            const defaultDomain = [
                ['payment_state', 'in', ['not_paid', 'partial']],
                ['move_type', '=', 'out_invoice'],
                ['state', '=', 'posted'],
            ];
            return {
                domain: this.state.searchString
                    ? [
                          ...defaultDomain,
                          '|',
                          ['name', 'ilike', this.state.searchString],
                          ['partner_id.name', 'ilike', this.state.searchString],
                      ]
                    : defaultDomain,
                fields: this.viewInfo.fieldsToLoad,
                limit: this.viewInfo.nPerPage,
                offset: (this.viewInfo.currentPage - 1) * this.viewInfo.nPerPage,
            };
        }
        _getLastPage() {
            const modulo = this.viewInfo.totalCount % this.viewInfo.nPerPage;
            const quotient = this.viewInfo.totalCount / this.viewInfo.nPerPage;
            return modulo === 0 ? quotient : Math.trunc(quotient) + 1;
        }
        isAtFirstPage() {
            return this.viewInfo.currentPage === 1;
        }
        isAtLastPage() {
            const lastPage = this._getLastPage();
            return this.viewInfo.currentPage >= lastPage;
        }
        getPageNumber() {
            const lastPage = this._getLastPage();
            if (lastPage === 0) {
                return '(0/0)';
            } else {
                return `(${this.viewInfo.currentPage}/${lastPage})`;
            }
        }
        getInvoiceDetails(invoice) {
            const result = {};
            const fieldsInfo = this.viewInfo.fieldsInfo;
            for (const key of this.viewInfo.fieldsToShow) {
                const fieldValue = {
                    classes: { [key]: true },
                    text: '',
                };
                const fieldInfo = fieldsInfo[key];
                if (NUMBER_TYPES.includes(fieldInfo.type)) {
                    // align right if field type is number
                    fieldValue.classes['total'] = true;
                }
                if (fieldInfo.type === 'monetary') {
                    fieldValue.text = this.env.pos.format_currency(invoice[key]);
                } else if (fieldInfo.type === 'many2one') {
                    fieldValue.text = invoice[key] ? invoice[key][1] : '';
                } else {
                    fieldValue.text = invoice[key] || '';
                }
                result[key] = fieldValue;
            }
            return result;
        }
        getHeaderDetails() {
            const result = {};
            const fieldsInfo = this.viewInfo.fieldsInfo;
            for (const key of this.viewInfo.fieldsToShow) {
                const fieldInfo = fieldsInfo[key];
                const header = {
                    classes: { [key]: true },
                    text: fieldInfo.string,
                };
                if (NUMBER_TYPES.includes(fieldInfo.type)) {
                    // align right if field type is number
                    header.classes['total'] = true;
                }
                result[key] = header;
            }
            return result;
        }
    }
    InvoiceListScreen.template = 'point_of_sale.InvoiceListScreen';

    Registries.Component.add(InvoiceListScreen);

    return InvoiceListScreen;
});
