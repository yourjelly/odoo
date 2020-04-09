odoo.define('point_of_sale.ErrorTracebackPopup', function(require) {
    'use strict';

    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');

    // formerly ErrorTracebackPopupWidget
    class ErrorTracebackPopup extends AbstractAwaitablePopup {
        get tracebackUrl() {
            const blob = new Blob([this.props.body]);
            const URL = window.URL || window.webkitURL;
            return URL.createObjectURL(blob);
        }
        get tracebackFilename() {
            return `${this.env._t('error')} ${moment().format('YYYY-MM-DD-HH-mm-ss')}.txt`;
        }
        emailTraceback() {
            const address = this.env.pos.company.email;
            const subject = this.env._t('IMPORTANT: Bug Report From Odoo Point Of Sale');
            window.open(
                'mailto:' +
                    address +
                    '?subject=' +
                    (subject ? window.encodeURIComponent(subject) : '') +
                    '&body=' +
                    (this.props.body ? window.encodeURIComponent(this.props.body) : '')
            );
        }
    }
    ErrorTracebackPopup.template = 'ErrorTracebackPopup';
    ErrorTracebackPopup.defaultProps = {
        confirmText: 'Ok',
        cancelText: 'Cancel',
        title: 'Error with Traceback',
        body: '',
        exitButtonIsShown: false,
        exitButtonText: 'Exit Pos',
        exitButtonTrigger: 'close-pos'
    };

    Registries.Component.add(ErrorTracebackPopup);

    return ErrorTracebackPopup;
});
