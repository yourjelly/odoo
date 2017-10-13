odoo.define('website_product_configurator.configurator', function(require) {
    'use strict';
    require('web_editor.ready');
    var core = require('web.core');
    var time = require('web.time');

    var _t = core._t;

    var $productConfigurator = $('.product_configurator');
    if (!$productConfigurator.length) {
        return $.Deferred().reject("DOM doesn't contain '.product_configurator'");
    }

    loadAjaxForm($('.js_add_cart_variants'));

    var $dateFields = $productConfigurator.find('.o_custom_date_field');
    if ($dateFields.length) {
        $dateFields.each(function() {
            initDatetimePicker($(this));
        });
    }

    //TOCHECK: may be replace by custom widget
    function initDatetimePicker($dateField) {
        var l10n = _t.database.parameters;
        var dateType = $dateField.data('type');
        var datepickers_options = {
            format: time.strftime_to_moment_format((dateType === 'datetime' ? (l10n.date_format + ' ' + l10n.time_format) : l10n.date_format)),
            minDate: moment({
                y: 1900
            }),
            maxDate: moment().add(200, "y"),
            calendarWeeks: true,
            icons: {
                time: 'fa fa-clock-o',
                date: 'fa fa-calendar',
                next: 'fa fa-chevron-right',
                previous: 'fa fa-chevron-left',
                up: 'fa fa-chevron-up',
                down: 'fa fa-chevron-down',
            },
            locale: moment.locale(),
            widgetParent: '.product_configurator',
        };
        $dateField.datetimepicker(datepickers_options);
    }
    //TODO: improve this method
    function checkErrorField($target) {
        var error_field = false;
        //clear the error message if any
        $target.find('.config_error').remove();
        $target.find('.has-error').removeClass('has-error');
        $target.find('input[type="text"], input[type="number"], textarea').each(function() {
            //check for required value
            var $elem = $(this);
            if ($elem.prop('required') && !$elem.val()) {
                $elem.parent('.form-group').addClass('has-error');
                error_field = true;
            }
            if ($elem.prop('type') === 'number') {
                var is_valid = checkMinMaxValidation($(this));
                if (!is_valid) {
                    error_field = true;
                }
            }
        });
        return error_field;
    }

    function checkMinMaxValidation($elem) {
        var numberType = $elem.attr('step') === 'any' ? 'float' : 'integer';
        var val = numberType === 'integer' ? parseInt($elem.val() || 0) : parseFloat($elem.val() || 0);
        var min_value =  numberType === 'integer' ? parseInt($elem.attr('min') || 0) : parseFloat($elem.attr('min') || 0);
        var max_value = numberType === 'integer' ? parseInt($elem.attr('max') || 0) : parseFloat($elem.attr('max') || 0);
        var msg = '';

        if (min_value && max_value && (val < min_value || val > max_value)) {
            msg = _t('Value must be between ' + min_value + ' and ' + max_value);
        } else if (min_value && val < min_value) {
            msg = _t('Value must be at least ' + min_value);
        } else if (max_value && val > max_value) {
            msg = _t('Value must be lower than ' + max_value);
        }

        if (msg) {
            $elem.before('<div class="text-danger config_error">' + msg + '</div>');
            return false;
        }
        return true;
    }

    function loadAjaxForm($form) {
        $form.ajaxForm({
            url: $form.attr('action'),
            type: 'POST',
            dataType: 'json',
            beforeSubmit: function(formData, $form, options) {
                if (checkErrorField($form)) {
                    return false;
                }
                $form.find('input[type="file"]').each(function() {
                    var field_obj = _.findWhere(formData, {
                        'name': this.name
                    });
                    field_obj.value = $(this).prop('files')[0]; //for now we consider only one attachment;
                });
            },
            success: function(response, status, xhr, wfe) {
                if (response.error) {
                    $form.find('.js_add_cart_variants').after('<div class="alert alert-danger config_error">' + response.error + '</div>');
                    return false;
                } else if (response.redirect) {
                    window.location.replace(response.redirect);
                    return true;
                } else {
                    console.error("Something Went Wrong");
                    return false;
                }
            },
            timeout: 5000,
        });
    }

});