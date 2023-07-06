/** @odoo-module **/

import loaderFunctions from "@web_editor/js/frontend/loader";

loaderFunctions.createWysiwyg = (parent, options) => {
  const { Wysiwyg } = odoo.loader.modules.get('@web_editor/js/wysiwyg/wysiwyg');
  return new Wysiwyg(parent, options.wysiwygOptions);
};
