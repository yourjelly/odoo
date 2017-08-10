define([
    'jquery',
    'summernote/base/core/agent',
    'summernote/base/core/list',
    'summernote/base/Context',
    'summernote/base/core/range',
    'summernote/base/core/key',
    'summernote/bs3/module/LinkDialog'
], function($, agent, list, Context, range, key, LinkDialog) {
    $.extend($.summernote, {
        core: {
            agent: agent,
            dom: $.summernote.dom,
            range: range,
            list: list,
            key: key,
        }
    });
    $.fn.extend({
        /**
         * Summernote API
         *
         * @param {Object|String}
         * @return {this}
         */
        summernote: function() {
            var type = $.type(list.head(arguments));
            var isExternalAPICalled = type === 'string';
            var hasInitOptions = type === 'object';

            var options = hasInitOptions ? list.head(arguments) : {};

            options = $.extend({}, $.summernote.options, options);

            // Update options
            options.langInfo = $.extend(true, {}, $.summernote.lang['en-US'], $.summernote.lang[options.lang]);
            options.icons = $.extend(true, {}, $.summernote.options.icons, options.icons);
            options.tooltip = options.tooltip === 'auto' ? !agent.isSupportTouch : options.tooltip;

            this.each(function(idx, note) {
                var $note = $(note);
                if (!$note.data('summernote')) {
                    var context = new Context($note, options);
                    $.summernote.LinkDialog = new LinkDialog(context); //Odoo added Context
                    $note.data('summernote', context);
                    $note.data('summernote').triggerEvent('init', context.layoutInfo);
                }
            });

            var $note = this.first();
            if ($note.length) {
                var context = $note.data('summernote');
                if (isExternalAPICalled) {
                    return context.invoke.apply(context, list.from(arguments));
                } else if (options.focus) {
                    context.invoke('editor.focus');
                }
            }

            return this;
        }
    });
});