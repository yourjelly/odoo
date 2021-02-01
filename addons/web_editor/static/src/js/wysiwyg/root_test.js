odoo.define("web_editor.wysiwyg.root.test", function (require) {
  "use strict";

  const WysiwygRoot = require("web_editor.wysiwyg.root");

  if (WysiwygRoot) {
      WysiwygRoot.include({
          assetLibs: null // We need to add the asset because tests performed overwrites (Dialog, Unbreakable...)
      });
  }
});
