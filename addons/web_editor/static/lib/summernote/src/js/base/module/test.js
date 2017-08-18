define([
  'summernote/bs3/settings',
], function() {
        var OdooCustom = function(context) {
        this.initialize = function() {
            $.summernote.context = context;
        }
    }
    $.summernote.options.modules.OdooCustom = OdooCustom
});
