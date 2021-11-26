odoo.define('point_of_sale.Printer', function (require) {
"use strict";

var Session = require('web.Session');
var core = require('web.core');
const { Gui } = require('point_of_sale.Gui');
var _t = core._t;
var ajax = require('web.ajax');

// IMPROVEMENT: This is too much. We can get away from this class.
class PrintResult {
    constructor({ successful, message }) {
        this.successful = successful;
        this.message = message;
    }
}

class PrintResultGenerator {
    IoTActionError() {
        return new PrintResult({
            successful: false,
            message: {
                title: _t('Connection to IoT Box failed'),
                body: _t('Please check if the IoT Box is still connected.'),
            },
        });
    }
    IoTResultError() {
        return new PrintResult({
            successful: false,
            message: {
                title: _t('Connection to the printer failed'),
                body: _t('Please check if the printer is still connected.'),
            },
        });
    }
    Successful() {
        return new PrintResult({
            successful: true,
        });
    }
}

var PrinterMixin = {
    init: function() {
        this.receipt_queue = [];
        this.printResultGenerator = new PrintResultGenerator();
        this.htmlToImgLetterRendering = false; // Whether to render each letter seperately. Necessary if letter-spacing is used.
    },


    send_printing_log: function () {
        return ajax.jsonRpc("/web/dataset/call_kw/ir_logging/create", 'call', {
            model: 'ir.logging',
            method: 'create',
            args: [{
                name: "Log Error drawImage Printer",
                type: 'server',
                path: '',
                func: '',
                line: '',
                message: window.debugLog,
              }],
            kwargs: {}
        });
    },

    /**
     * Add the receipt to the queue of receipts to be printed and process it.
     * We clear the print queue if printing is not successful.
     * @param {String} receipt: The receipt to be printed, in HTML
     * @returns {PrintResult}
     */
    print_receipt: async function(receipt) {
        if (receipt) {
            this.receipt_queue.push(receipt);
        }
        let image, sendPrintResult;
        while (this.receipt_queue.length > 0) {
            receipt = this.receipt_queue.shift();
            image = await this.htmlToImg(receipt).catch(async (e) => {
                await this.send_printing_log();
                throw e;
            });
            try {
                sendPrintResult = await this.send_printing_job(image);
            } catch (error) {
                // Error in communicating to the IoT box.
                this.receipt_queue.length = 0;
                return this.printResultGenerator.IoTActionError();
            }
            // rpc call is okay but printing failed because
            // IoT box can't find a printer.
            if (!sendPrintResult || sendPrintResult.result === false) {
                this.receipt_queue.length = 0;
                return this.printResultGenerator.IoTResultError();
            }
        }
        return this.printResultGenerator.Successful();
    },

    /**
     * Generate a jpeg image from a canvas
     * @param {DOMElement} canvas
     */
    process_canvas: function (canvas) {
        return canvas.toDataURL('image/jpeg').replace('data:image/jpeg;base64,','');
    },

    /**
     * Renders the html as an image to print it
     * @param {String} receipt: The receipt to be printed, in HTML
     */
    htmlToImg: function (receipt) {
        window.debugLog = {
            date: new Date().toUTCString(),
            timestamp: Date.now(),
            logs: [],
        };
        window.debughtml2canvas.Util.log = function(a) {
            window.debugLog.logs.push(a);
        };

        var self = this;
        $('.pos-receipt-print').html(receipt);
        var promise = new Promise(function (resolve, reject) {
            self.receipt = $('.pos-receipt-print>.pos-receipt');
            window.debugLog.html = self.receipt.html();
            html2canvas(self.receipt[0], {
                onparsed: function(queue) {
                    const oldValue = queue.stack.ctx.height;
                    // $('.pos-receipt-print').empty();
                    queue.stack.ctx.height = Math.ceil(self.receipt.outerHeight() + self.receipt.offset().top);
                    if (queue.stack.ctx.height === 0) {
                        window.debugLog.selfReceipt = self.receipt.prop('outerHTML');
                        window.debugLog.outerHeight = self.receipt.outerHeight();
                        window.debugLog.offset = self.receipt.offset();
                        window.debugLog.timestampOnParsed = Date.now();
                        window.debugLog.callStack = new Error().stack;
                        window.debugLog.oldHeight = oldValue;
                        reject("printing_error");
                    }
                },
                onrendered: function (canvas) {
                    window.debugLog.timestampOnRendered = Date.now();
                    $('.pos-receipt-print').empty();
                    resolve(self.process_canvas(canvas));
                },
                letterRendering: self.htmlToImgLetterRendering,
            })
        });
        return promise;
    },

    _onIoTActionResult: function (data){
        if (this.pos && (data === false || data.result === false)) {
            Gui.showPopup('ErrorPopup',{
                'title': _t('Connection to the printer failed'),
                'body':  _t('Please check if the printer is still connected.'),
            });
        }
    },

    _onIoTActionFail: function () {
        if (this.pos) {
            Gui.showPopup('ErrorPopup',{
                'title': _t('Connection to IoT Box failed'),
                'body':  _t('Please check if the IoT Box is still connected.'),
            });
        }
    },
}

var Printer = core.Class.extend(PrinterMixin, {
    init: function (url, pos) {
        PrinterMixin.init.call(this, arguments);
        this.pos = pos;
        this.htmlToImgLetterRendering = pos.htmlToImgLetterRendering();
        this.connection = new Session(undefined, url || 'http://localhost:8069', { use_cors: true});
    },

    /**
     * Sends a command to the connected proxy to open the cashbox
     * (the physical box where you store the cash). Updates the status of
     * the printer with the answer from the proxy.
     */
    open_cashbox: function () {
        var self = this;
        return this.connection.rpc('/hw_proxy/default_printer_action', {
            data: {
                action: 'cashbox'
            }
        }).then(self._onIoTActionResult.bind(self))
            .guardedCatch(self._onIoTActionFail.bind(self));
    },

    /**
     * Sends the printing command the connected proxy
     * @param {String} img : The receipt to be printed, as an image
     */
    send_printing_job: function (img) {
        return this.connection.rpc('/hw_proxy/default_printer_action', {
            data: {
                action: 'print_receipt',
                receipt: img,
            }
        });
    },
});

return {
    PrinterMixin: PrinterMixin,
    Printer: Printer,
    PrintResult,
    PrintResultGenerator,
}
});
