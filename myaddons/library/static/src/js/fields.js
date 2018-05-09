
odoo.define('library.fields', function (require) {
    "use strict";
    var basicFields = require('web.basic_fields');
    var fieldRegistry = require('web.field_registry');

    var core = require('web.core');
    var qweb = core.qweb;

    var YearFieldInteger = basicFields.FieldInteger.extend({
        /**
         * @override
         */
        _formatValue: function (value) {
            return value;
        },
    });

    var LateWidget = basicFields.FieldBoolean.extend({
        className: 'o_field_late_boolean',
        init: function () {
            this._super.apply(this, arguments);
            this.lateColor = this.nodeOptions.late_color || 'red';
            this.inTimeColor = this.nodeOptions.inTime_color || 'green';
        },
        /**
        * @override
        * @private
        */
        _render: function() {
            this.$el.html($('<div>').css({
                backgroundColor: this.value ? this.lateColor : this.inTimeColor
            }));
        },
    });

    var LostWidget = basicFields.FieldChar.extend({
        init: function () {
            this._super.apply(this, arguments);
            this.lostColor = 'red';
            this.normalColor = 'black';
        },
        _render: function() {
            if (this.value == 'lost'){
                this.$el.html($('<div>' + this.value +'<img src="http://www.stickpng.com/assets/images/5a81af7d9123fa7bcc9b0793.png" class="o_field_lost"></div>').css({
                    color: this.lostColor
                }));
            }
            else
                this.$el.html($('<div>' + this.value +'</div>'));
        },
//        color: this.value == 'lost' ? this.lostColor : this.normalColor
    });

    var LibraryWarning = basicFields.FieldFloat.extend({
        /**
         * @override
         * @private
         */
        _renderReadonly: function () {
            if (this.value > 50) {
                this.$el.html(qweb.render('LibraryDebtWarning', {amount: this.value}));
            }
            else if (this.value > 20) {
                this.$el.html(qweb.render('LibrarySmallDebtWarning', {amount: this.value}));
            }
            else {
                this.$el.empty();
            }
        },
    });

    fieldRegistry.add('year_widget', YearFieldInteger);
    fieldRegistry.add('late_widget', LateWidget);
    fieldRegistry.add('lost_widget', LostWidget);
    fieldRegistry.add('library-debt-warning', LibraryWarning);
});