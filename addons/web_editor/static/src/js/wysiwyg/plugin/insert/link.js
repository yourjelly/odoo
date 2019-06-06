odoo.define('web_editor.we3.plugin.link', function (require) {
    'use strict';

var LinkDialog = require('wysiwyg.widgets.LinkDialog');

//--------------------------------------------------------------------------
// link
//--------------------------------------------------------------------------

var LinkCreate = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_link.xml'];
        this.buttons = {
            template: 'wysiwyg.buttons.link',
        };
        this.blankContent = "Label";
        this.dependencies = ['Arch', 'Range'];
    }

    showLinkDialog (value, node) {
        var self = this;
        // var range = this.dependencies.Range.getRange();
        // var selectedNodes = this.dependencies.Range.getSelectedNodes(node.isText);
        return new Promise(function (resolve) {
            var linkDialog = new LinkDialog(self, {}, self._getLinkInfo(node));
            linkDialog.on('save', self, self._onSaveDialog.bind(self));
            linkDialog.on('closed', self, resolve);
            linkDialog.open();
        });
    }
    _getLinkInfo (node) {
        var anchor = node.isAnchor() ? node : node.ancestor(node.isAnchor);
        var range = this.dependencies.Range.getRange();
        return {
            isAnchor: !!anchor,
            anchor: anchor,
            node: node,
            text: anchor ? anchor.next().toString() : range.getSelection().toString(),
            url: anchor ? anchor.attributes.href : '',
            needLabel: true, // TODO: see what was done before: !text or option ?
            className: anchor ? anchor.className.toString() : '',
        };
    }
    /**
     * @param {Object} linkInfo
     * @param {String} linkInfo.url
     * @param {String} linkInfo.className
     * @param {Object} linkInfo.style
     * @param {Boolean} linkInfo.replaceLink
     * @param {Boolean} linkInfo.isNewWindow
     */
    _onSaveDialog (linkInfo) {
        var anchor;
        if (linkInfo.isAnchor) {
            anchor = linkInfo.anchor;
        } else {
            var anchorID = this.dependencies.Arch.wrapRange('A')[0];
            anchor = this.dependencies.Arch.getClonedArchNode(anchorID);
        }

        if (!linkInfo.node.isVoidoid()) {
            anchor.empty();
            var linkContent;
            if (linkInfo.text && linkInfo.text.length) {
                linkContent = linkInfo.text;
            } else {
                linkContent = linkInfo.url;
            }
            anchor.insert(this.dependencies.Arch.parse(linkContent));
        }

        anchor.attributes.add('href', linkInfo.url);
        anchor.attributes.add('class', linkInfo.className);
        if (linkInfo.isNewWindow) {
            anchor.attributes.add('target', '_blank');
        } else {
            anchor.attributes.remove('target');
        }
        if (linkInfo.style) {
            anchor.attributes.style.update(linkInfo.style);
        }

        this.dependencies.Arch.importUpdate([anchor.toJSON()]);

        anchor = this.dependencies.Arch.getClonedArchNode(anchor.id);
        var nextSibling = anchor.lastChild().next();
        if (!nextSibling.id) {
            this.dependencies.Arch.insertAfter(nextSibling, anchor.id);
        } else {
            this.dependencies.Range.setRange({
                scID: nextSibling.id,
                so: 0
            });
        }
    }
};

var Link = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_link.xml'];
        this.dependencies = ['Arch', 'LinkCreate'];
        this.buttons = {
            template: 'wysiwyg.popover.link',
            events: {
                'dblclick': '_onDblclick',
            },
        };
    }

    get (archNode) {
        var anchor = archNode.ancestor('isAnchor');
        if (anchor && anchor.isVoidoid()) {
            anchor = null;
        }
        return anchor;
    }

    fillEmptyLink (link) {
        if (this.dependencies.Arch.isEditableNode(link)) {
            link.textContent = this.dependencies.LinkCreate.blankContent;
        }
    }
    /**
     * @param {Object} linkInfo
     * @param {WrappedRange} range
     * @returns {Promise}
     */
    showLinkDialog (value, range) {
        return this.dependencies.LinkCreate.showLinkDialog(value, range);
    }
    /**
     * Remove the current link, keep its contents.
     */
    unlink (value, node) {
        this.dependencies.Arch.unwrap(node.childNodes.map(node => node.id));
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {jQueryEvent} e
     */
    _onDblclick (e) {
        return this.showLinkDialog(null, this.dependencies.Range.getRange());
    }
};

we3.addPlugin('Link', Link);
we3.addPlugin('LinkCreate', LinkCreate);

});
