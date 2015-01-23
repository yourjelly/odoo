openerp.pos_demo = function(instance) {

    var module   = instance.point_of_sale;
    var round_pr = instance.web.round_precision;
    var QWeb     = instance.web.qweb;
    var _t       = instance.web._t;

    window.demo_mode = window.demo_mode || localStorage['demo_mode'] || 'normal';
    window.demo_data = localStorage['demo_data'] ? JSON.parse(localStorage['demo_data']) : openerp.pos_demo_data;

    function message(msg, arg) {
        if (window.top && window.top !== window) {
            console.log('sending:',msg,arg);
            window.top.postMessage(msg,'*');
        } else {
            console.log('not sending',msg,arg);
        }
    }

    // Some modifications that we want in playback mode
    // only, so that the regular pos is not broken when
    // this module is installed.

    if (demo_mode === 'playback') {

        var weight = 0;

        /* --- Prevent access to the backend --- */

        module.Gui.include({
            close: function() {
                message('close');
            },
        });

        /* --- overriding the proxy --- */

        module.BarcodeReader.include({
            connect_to_proxy: function(){},
        });

        module.ProxyDevice.include({
            message: function(name, params) {
                message(name);
                return (new $.Deferred()).resolve();
            },
            connect: function() {
                this.set_connection_status('connected',{
                    scale:   {status: 'connected'},
                escpos:  {status: 'connected'},
                scanner: {status: 'connected'},
                });
                return (new $.Deferred()).resolve();
            },
            autoconnect: function() {
                return this.connect();
            },
            try_hard_to_connect: function(){},
            find_proxy: function() {
                return (new $.Deferred()).resolve('http://localhost/');
            },
            stop_searching: function(){},
            scale_read: function() {
                message('scale_read');
                return (new $.Deferred()).resolve(weight);
            },
            print_receipt: function(receipt) { 
                message('print');
            },
            open_cashbox: function() {
                message('open_cashbox');
            },
        });

        /* --- module.Printer --- */

        module.Printer.include({
            print: function(receipt) {
                message('print_order',this.config);
            },
        });

    } // End of Playback-Only modifications



    /* --- RPC Recording & Playback --- */

    if (demo_mode === 'recording') {

        console.info(['RECORDING MODE',
                      'Use save_demo_data() to generate the demo data file.',
                      'Use clear_demo_data() to clear the recorded data from localStorage.',
                      ].join('\n'));

        // Save the recorded demo data to a .js file. 
        // Used to generate the /static/src/js/datajs 
        // file. 

        window.save_demo_data = function(filename){

            if (!filename) { 
                filename = 'data.js'
            }

            var data = 'openerp.pos_demo_data = ' + JSON.stringify(window.demo_data, undefined, 4) + ';\n';

            var blob = new Blob([data], {type: 'text/json'}),
                e    = document.createEvent('MouseEvents'),
                a    = document.createElement('a');

            a.download = filename;
            a.href = window.URL.createObjectURL(blob);
            a.dataset.downloadurl =  ['text/json', a.download, a.href].join(':');
            e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            a.dispatchEvent(e);
        }

        window.clear_demo_data = function(){
            if (localStorage['demo_data']) {
                delete localStorage['demo_data'];
                console.info('Demo data cleared.');
            } else {
                console.info('Nothing to clear.');
            }
        };
    }

    // intercept rpc and depending on the window.demo_mode
    // global variable:
    // - 'recording' : record the reponse for a later playback,
    //     the recordings are put into localstorage so that
    //     you can playback the recording without modifying
    //     the module
    // - 'playback'  : the rpc replay their recorded values
    // -    else     : the rpc behaves as usual.

    openerp.Session.include({
        rpc: function(url, params, options) {
            var self = this;
            params  = params  || [];
            options = options || {};

            // convert a generic 'json' object into a sorted
            // array based object. Two equivalent objects will
            // lead to the same string when their sorted versions
            // are stringified. This is used to transform the rpc
            // parameters into dictionary keys.

            function sortify(obj) {
                var sorted = [];
                if ((typeof obj === 'number')  ||
                    (typeof obj === 'string')  ||
                    (typeof obj === 'boolean')) {
                    sorted = obj;
                } else if (obj instanceof Array) {
                    for (var i = 0; i < obj.length; i++) {
                        sorted.push(sortify(obj[i]));
                    }
                } else {
                    for (o in obj) {
                        if (obj.hasOwnProperty(o)) {
                            sorted.push([o, sortify(obj[o])]);
                        }
                    }
                    sorted.sort(function(a,b){ return a[0].localeCompare(b[0]) });
                }
                return sorted;
            }

            var key = JSON.stringify([url, sortify(params), sortify(options)]);

            if (window.demo_mode === 'recording') {
                return this._super(url, params, options).then(function(result) {
                    console.info('RPC Recording:',url);
                    window.demo_data[key] = JSON.stringify(result);
                    localStorage['demo_data'] = JSON.stringify(window.demo_data);
                    return result;
                });
            } else if (window.demo_mode === 'playback') {
                console.info('RPC Playback:',url);
                var rpc = new $.Deferred();
                setTimeout(function(){
                    var result = window.demo_data[key];
                    if (result) { 
                        rpc.resolve(JSON.parse(result));
                    } else {
                        // If nothing was recorded, we let the deferred
                        // hang eternally, so that the resulting code
                        // does not crash with wrong or no data.
                        console.warn('Could not replay RPC.');
                    }
                },50);
                return rpc;
            } else {
                return this._super(url, params, options);
            }
        },
    });
};

