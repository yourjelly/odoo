(function () {
'use strict';

var TransformPlugin = class extends we3.AbstractPlugin {
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Manages transformations on a media.
     */
    transform (value, target) {
        var $image = $(target);

        if ($image.data('transfo-destroy')) {
            $image.removeData('transfo-destroy');
            return;
        }

        $image.transfo(); // see web_editor/static/lib/jQuery.transfo.js

        var mouseup = function () {
            $('.note-popover button[data-event="transform"]').toggleClass('active', $image.is('[style*="transform"]'));
        };
        $(document).on('mouseup', mouseup);

        var mousedown = this._wrapCommand(function (event) {
            if (!$(event.target).closest('.transfo-container').length) {
                $image.transfo('destroy');
                $(document).off('mousedown', mousedown).off('mouseup', mouseup);
            }
            if ($(event.target).closest('.note-popover').length) {
                var transformStyles = this.utils.getRegex('', 'g', '[^;]*transform[\\w:]*;?');
                $image.data('transfo-destroy', true).attr('style', ($image.attr('style') || '').replace(transformStyles, ''));
            }
        });
        $(document).on('mousedown', mousedown);
    }
};

we3.addPlugin('TransformPlugin', TransformPlugin);

})();
