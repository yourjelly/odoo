odoo.define('website_product_configurator.configurator', function (require) {
'use strict';
    require('web_editor.ready');
    var core = require('web.core');
    var time = require('web.time');

    var _t = core._t;

    var $productConfigurator = $('.product_configurator');
    if (!$productConfigurator.length) {
        return $.Deferred().reject("DOM doesn't contain '.product_configurator'");
    }

    var $dateFields = $productConfigurator.find('.o_custom_date_field');
    if($dateFields.length) {
        $dateFields.each(function() {
            initDatetimePicker($(this));
        });
    }

    //TOCHECK: may be replace by custom widget
    function initDatetimePicker($dateField) {
        var l10n = _t.database.parameters;
        var dateType = $dateField.data('type');
        var datepickers_options = {
            format : time.strftime_to_moment_format((dateType === 'datetime'? (l10n.date_format +' '+ l10n.time_format): l10n.date_format)),
            minDate: moment({ y: 1900 }),
            maxDate: moment().add(200, "y"),
            calendarWeeks: true,
            icons : {
                time: 'fa fa-clock-o',
                date: 'fa fa-calendar',
                next: 'fa fa-chevron-right',
                previous: 'fa fa-chevron-left',
                up: 'fa fa-chevron-up',
                down: 'fa fa-chevron-down',
               },
            locale : moment.locale(),
            widgetParent: '.product_configurator',
        };
        $dateField.datetimepicker(datepickers_options);
    }

    function checkErrorField($target) {
        var res = false;
        $target.find('input:required, textarea:required').each(function() {
            var $elem = $(this);
            if (!$elem.val()) {
                $elem.parent('.form-group').addClass('has-error');
                res = true;
            }
        });
        return res;
    }

    $('.oe_website_sale .a-submit, #comment .a-submit').off('click').on('click', function (event) {
        if (!event.isDefaultPrevented() && !$(this).is(".disabled")) {
            event.preventDefault();
            var $form = $(this).closest('form');
            if(!checkErrorField($form)) {
                $form.submit();
            }
            return false;

        }
        if ($(this).hasClass('a-submit-disable')){
            $(this).addClass("disabled");
        }
        if ($(this).hasClass('a-submit-loading')){
            var loading = '<span class="fa fa-cog fa-spin"/>';
            var fa_span = $(this).find('span[class*="fa"]');
            if (fa_span.length){
                fa_span.replaceWith(loading);
            }
            else{
                $(this).append(loading);
            }
        }
    });
});