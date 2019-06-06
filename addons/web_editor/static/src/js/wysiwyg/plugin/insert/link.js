(function () {
'use strict';

// var LinkDialog = require('wysiwyg.widgets.LinkDialog');

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
    }

    showLinkDialog (value, range) {
        var self = this;
        return new Promise(function (resolve) {
            var linkDialog = new LinkDialog(self, {}, self._getLinkInfo(range));
            linkDialog.on('save', self, self._onSaveDialog.bind(self));
            linkDialog.on('closed', self, resolve);
            linkDialog.open();
        });
    }
    _getLinkInfo (range) {
        var nodes = this._getNodesToLinkify(range);
        var ancestor = range.commonAncestor();
        var anchorAncestor = ancestor.ancestor('isAnchor');
        var text = this._getTextToLinkify(range, nodes);

        var linkInfo = {
            isAnchor: !!anchorAncestor,
            anchor: anchorAncestor,
            text: text,
            url: anchorAncestor ? anchorAncestor.attributes.href : '',
            needLabel: true, // TODO: see what was done before: !text or option ?
            className: anchorAncestor ? anchorAncestor.className.toString() : '',
        };

        return linkInfo;
    }
    _getNodesToLinkify (range) {
        var ancestor = range.commonAncestor();
        var anchorAncestor = ancestor.ancestor('isAnchor');
        if (anchorAncestor) {
            return anchorAncestor.childNodes;
        }
        var nodes = [range.scArch];
        if (range.scArch !== range.ecArch) {
            range.scArch.nextUntil(function (next) {
                nodes.push(next);
                return next === range.ecArch;
            });
        }
        return nodes;
    }
    _getTextToLinkify (range, nodes) {
        if (nodes.length <= 0) {
            return;
        }

        var anchorAncestor = nodes[0].ancestor('isAnchor');
        var text = "";
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.ancestor('isVoidoid')) {
                text += node.ancestor('isVoidoid').toString();
            } else if (!anchorAncestor && nodes[i].nodeType === 1) {
                // just use text nodes from listBetween
            } else {
                var content = nodes[i].toString({onlyText: true});
                if (!anchorAncestor && i === nodes.length - 1 && node === range.ecArch && node.isText()) {
                    content = content.slice(0, range.eo);
                }
                if (!anchorAncestor && i === 0 && node === range.scArch && node.isText()) {
                    content = content.slice(range.so);
                }
                text += content;
            }
        }
        return text.replace(this.utils.getRegex('space', 'g'), ' ');
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
            this.dependencies.Arch.setRange({scID: anchor.id});
            anchor.empty();
        } else {
            anchor = this.dependencies.Arch.parse('<a></a>').firstChild();
        }

        anchor.insert(this.dependencies.Arch.parse(linkInfo.text));
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

        if (linkInfo.isAnchor) {
            this.dependencies.Arch.importUpdate([anchor.toJSON()]);
        } else {
            this.dependencies.Arch.insert(anchor);
        }
    }
};

var Link = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_link.xml'];
        this.dependencies = ['LinkCreate'];
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
    unlink (value, range) {
        var ancestor = range.commonAncestor();
        var anchorAncestor = ancestor.ancestor('isAnchor');
        if (anchorAncestor) {
            this.dependencies.Arch.unwrap(anchorAncestor.id);
        }
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

})();
