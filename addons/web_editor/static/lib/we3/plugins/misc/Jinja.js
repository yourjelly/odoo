(function () {
'use strict';


var jinjaExp = /(^|\n)\s*%\s?(end|endif|else|if|set)/;
var isJinjaLineExp = /^\n?\s*((%\s?(end|endif|else|(if|set) [^\n]+)?)|(\{%.*%\})|(\$\{[^}]+\}\s*%?))\s*\n?$/;


var JINJA = class extends we3.ArchNodeText {
    //--------------------------------------------------------------------------
    // static
    //--------------------------------------------------------------------------

    static parse (json) {
        if (json.type === 'TEXT' && jinjaExp.test(json.nodeValue)) {
            return JINJA._splitTextArchNode(json);
        }
    }
    static _splitTextArchNode (json) {
        if (json.type === 'JINJA') {
            return json;
        }
        return {
            type: 'FRAGMENT',
            childNodes: json.nodeValue.trim().split('\n').map(function (line) {
                return [{
                    type: 'JINJA',
                    nodeValue: '\n',
                }, {
                    type: isJinjaLineExp.test(line) ? 'JINJA' : 'TEXT',
                    nodeValue: line.trim(),
                }];
            }).flat(),
        };
    }

    //--------------------------------------------------------------------------
    // public
    //--------------------------------------------------------------------------

    isBlock () {
        return true;
    }
    isInPre () {
        return true;
    }
    isJinja () {
        return true;
    }
    get type () {
        return 'JINJA';
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _addArchitecturalSpaceNode () {
        this.nodeValue = this.nodeValue.replace(/^\n|\n$/g, '');
        if (!this.nodeValue.length) {
            this.remove();
            return;
        }
        if (this.__removed || !this.parent || this._hasArchitecturalSpace) {
            return;
        }

        this.before(this.params.create('ArchitecturalSpace'));
        if (this.isRightEdge()) {
            this.after(this.params.create('ArchitecturalSpace'));
        }
        this._hasArchitecturalSpace = true;
    }
    _applyRulesArchNode () {
        return;
    }
    _getParentedRules () {
        var parentedRules = super._getParentedRules();
        parentedRules.push({
            nodes: {
                methods: ['isJinja'],
            },
            permittedParents: {
                methods: ['isNotText'],
            }
        });
        return parentedRules;
    }
};
we3.addArchNode('JINJA', JINJA);


var JinjaPlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['CodeView'];
    }

    /**
     * @overwrite
     */
    setEditorValue (value) {
        if (jinjaExp.test(value)) {
            this.dependencies.CodeView.active(value);
        }
        return value;
    }
};

we3.addPlugin('Jinja', JinjaPlugin);

})();
