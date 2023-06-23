/** @odoo-module **/

import loaderFunctions from "@web_editor/js/frontend/loader";

loaderFunctions.createWysiwyg = (parent, options) => {
  const { Wysiwyg } = odoo.__DEBUG__.services['@web_editor/js/wysiwyg/wysiwyg'];
  return new Wysiwyg(parent, options.wysiwygOptions);
};
