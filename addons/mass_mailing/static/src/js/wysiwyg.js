/** @odoo-module **/

import Wysiwyg from 'web_editor.wysiwyg'

Wysiwyg.include({
    /**
     *@override
     */
    _isElementOpenLinkPopover($target) {
        return this._super.apply(this, arguments) && !$($target).parent('.o_mail_footer_social').length;
    }
})
