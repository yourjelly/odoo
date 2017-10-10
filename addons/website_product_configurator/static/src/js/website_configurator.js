odoo.define('website_product_configurator.configurator', function (require) {
'use strict';
    require('web_editor.ready');
    if (!$('#product_detail').length) {
        return $.Deferred().reject("DOM doesn't contain '#product_detail'");
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


