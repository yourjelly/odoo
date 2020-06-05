
odoo.define('web_editor.wysiwyg.default_options', function (require) {
'use strict';

/**
 * TODO this should be refactored to be done another way, same as the 'root'
 * module that should be done another way.
 *
 * This allows to have access to default options that are used in the summernote
 * editor so that they can be tweaked (instead of entirely replaced) when using
 * the editor on an editable content.
 */

var core = require('web.core');

var _lt = core._lt;

return {
    styleTags: ['p', 'pre', 'small', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
    fontSizes: [_lt('Default'), 8, 9, 10, 11, 12, 14, 18, 24, 36, 48, 62],
};
});
