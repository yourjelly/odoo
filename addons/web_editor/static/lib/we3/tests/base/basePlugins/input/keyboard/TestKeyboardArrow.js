(function () {
'use strict';

var TestKeyboardArrow = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['TestKeyboard'];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Test', 'TestKeyboard'];

        // range collapsed: ◆
        // range start: ▶
        // range end: ◀

        /**
        * todo:
        * - implement shift-right
        * - fix shift-left
        * - fix ◆▶◀ on voidoid set/get (in Test, we3ToVoidoid etc. not working)
        */
        this.unitTests = [
            {
                name: "on text selection",
                content: "<p>dom▶ to◀ edit</p>",
                leftTest: "<p>dom◆ to edit</p>",
                rightTest: "<p>dom to◆ edit</p>",
                shiftLeftTest: "<p>dom▶ t◀o edit</p>",
                shiftRightTest: "<p>dom▶ to ◀edit</p>",
            },
            {
                name: "at edge",
                leftContent: "<p>◆dom to edit</p>",
                rightContent: "<p>dom to edit◆</p>",
                leftTest: "<p>◆dom to edit</p>",
                rightTest: "<p>dom to edit◆</p>",
                shiftLeftTest: "<p>◆dom to edit</p>",
                shiftRightTest: "<p>dom to edit◆</p>",
            },
            {
                name: "through virtual text node",
                // leftContent: "<p>dom t\uFEFF◆o edit</p>",
                rightContent: "<p>dom t◆\uFEFFo edit</p>",
                // leftTest: "<p>dom ◆to edit</p>",
                rightTest: "<p>dom to◆ edit</p>",
                // shiftLeftTest: "<p>dom ▶t◀o edit</p>",
                shiftRightTest: "<p>dom t▶o◀ edit</p>",
                testDOM: "<p>dom t&#65279;o edit</p>",
            },
            {
                repeat: 2,
                name: "through virtual text node",
                // leftContent: "<p>dom t\uFEFFo◆ edit</p>",
                rightContent: "<p>dom ◆t\uFEFFo edit</p>",
                leftTest: "<p>dom ◆to edit</p>",
                // rightTest: "<p>dom to◆ edit</p>",
                // shiftLeftTest: "<p>dom ▶to◀ edit</p>",
                shiftRightTest: "<p>dom ▶to◀ edit</p>",
                testDOM: "<p>dom t&#65279;o edit</p>",
            },
            {
                repeat: 2,
                name: "through 3 virtual text node",
                // leftContent: "<p>dom t\uFEFF\uFEFF\uFEFFo◆ edit</p>",
                rightContent: "<p>dom ◆t\uFEFF\uFEFF\uFEFFo edit</p>",
                // leftTest: "<p>dom ◆to edit</p>",
                rightTest: "<p>dom to◆ edit</p>",
                // shiftLeftTest: "<p>dom ▶to◀ edit</p>",
                shiftRightTest: "<p>dom ▶to◀ edit</p>",
                testDOM: "<p>dom t&#65279;&#65279;&#65279;o edit</p>",
            },
            // crossing images
            {
                name: "on image",
                content: '<p>dom to ▶<img src="/web_editor/static/src/img/transparent.png"/>◀ edit</p>',
                leftTest: '<p>dom to ◆<img src="/web_editor/static/src/img/transparent.png"/> edit</p>',
                rightTest: '<p>dom to <img src="/web_editor/static/src/img/transparent.png"/>◆ edit</p>',
                // shiftLeftTest: '<p>dom to▶ <img src="/web_editor/static/src/img/transparent.png"/>◀ edit</p>',
                // shiftRightTest: '<p>dom to ▶<img src="/web_editor/static/src/img/transparent.png"/> ◀edit</p>',
            },
            {
                name: "next to image",
                leftContent: '<p>dom to <img src="/web_editor/static/src/img/transparent.png"/>◆ edit</p>',
                rightContent: '<p>dom to ◆<img src="/web_editor/static/src/img/transparent.png"/> edit</p>',
                leftTest: '<p>dom to ◆<img src="/web_editor/static/src/img/transparent.png"/> edit</p>',
                rightTest: '<p>dom to <img src="/web_editor/static/src/img/transparent.png"/>◆ edit</p>',
                // shiftLeftTest: '<p>dom to ▶<img src="/web_editor/static/src/img/transparent.png"/>◀ edit</p>',
                // shiftRightTest: '<p>dom to ▶<img src="/web_editor/static/src/img/transparent.png"/>◀ edit</p>',
            },
            {
                name: "on image at edge of unbreakable",
                leftContent: '<p>▶<img src="/web_editor/static/src/img/transparent.png"/>◀ dom to edit</p>',
                rightContent: '<p>dom to edit ▶<img src="/web_editor/static/src/img/transparent.png"/>◀</p>',
                leftTest: '<p>◆<img src="/web_editor/static/src/img/transparent.png"/> dom to edit</p>',
                rightTest: '<p>dom to edit <img src="/web_editor/static/src/img/transparent.png"/>◆</p>',
                shiftLeftTest: '<p>◆<img src="/web_editor/static/src/img/transparent.png"/> dom to edit</p>',
                // shiftRightTest: '<p>dom to edit <img src="/web_editor/static/src/img/transparent.png"/>◆</p>',
            },
            // todo: fix LEFT tests (behavior ok but test module can't use native LEFT so we get a false negative)
            {
                repeat: 3,
                name: "through image",
                // leftContent: '<p>dom to <img src="/web_editor/static/src/img/transparent.png"/> ◆edit</p>',
                rightContent: '<p>dom to◆ <img src="/web_editor/static/src/img/transparent.png"/> edit</p>',
                // leftTest: '<p>dom to◆ <img src="/web_editor/static/src/img/transparent.png"/> edit</p>',
                rightTest: '<p>dom to <img src="/web_editor/static/src/img/transparent.png"/> ◆edit</p>',
                // shiftLeftTest: '<p>dom to◆ <img src="/web_editor/static/src/img/transparent.png"/> edit</p>',
                // shiftRightTest: '<p>dom to▶ <img src="/web_editor/static/src/img/transparent.png"/> ◀edit</p>',
            },
            {
                repeat: 2,
                name: "next to image at edge of unbreakable",
                leftContent: '<p><img src="/web_editor/static/src/img/transparent.png"/> ◆dom to edit</p>',
                rightContent: '<p>dom to edit◆ <img src="/web_editor/static/src/img/transparent.png"/></p>',
                leftTest: '<p>◆<img src="/web_editor/static/src/img/transparent.png"/> dom to edit</p>',
                rightTest: '<p>dom to edit <img src="/web_editor/static/src/img/transparent.png"/>◆</p>',
                // shiftLeftTest: '<p>▶<img src="/web_editor/static/src/img/transparent.png"/> ◀dom to edit</p>',
                shiftRightTest: '<p>dom to edit▶ <img src="/web_editor/static/src/img/transparent.png"/>◀</p>',
            },
            {
                name: "on image in table",
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<img src="/web_editor/static/src/img/transparent.png"/>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
                leftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
                rightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"/>◆</p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftLeftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftRightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<img src="/web_editor/static/src/img/transparent.png"/>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
            },
            {
                name: "on image in table without spaces",
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<img src="/web_editor/static/src/img/transparent.png"/>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
                leftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
                rightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"/>◆</p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftLeftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftRightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<img src="/web_editor/static/src/img/transparent.png"/>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
            },
            {
                name: "on image in table without spaces (2)",
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<img src="/web_editor/static/src/img/transparent.png"/>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
                leftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
                rightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"/>◆</p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftLeftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftRightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<img src="/web_editor/static/src/img/transparent.png"/>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
            },
            // crossing voidoids
            {
                name: "on voidoid",
                content: '<p>dom to ▶<i class="fa fa-glass"></i>◀ edit</p>',
                leftTest: '<p>dom to ◆<i class="fa fa-glass"></i> edit</p>',
                rightTest: '<p>dom to <i class="fa fa-glass"></i>◆ edit</p>',
                // shiftLeftTest: '<p>dom to▶ <i class="fa fa-glass"></i>◀ edit</p>',
                // shiftRightTest: '<p>dom to ▶<i class="fa fa-glass"></i> ◀edit</p>',
            },
            {
                name: "next to voidoid",
                leftContent: '<p>dom to <i class="fa fa-glass"></i>◆ edit</p>',
                rightContent: '<p>dom to ◆<i class="fa fa-glass"></i> edit</p>',
                leftTest: '<p>dom to ◆<i class="fa fa-glass"></i> edit</p>',
                rightTest: '<p>dom to <i class="fa fa-glass"></i>◆ edit</p>',
                // shiftLeftTest: '<p>dom to ▶<i class="fa fa-glass"></i>◀ edit</p>',
                // shiftRightTest: '<p>dom to ▶<i class="fa fa-glass"></i>◀ edit</p>',
            },
            {
                name: "on voidoid at edge of unbreakable",
                leftContent: '<p>▶<i class="fa fa-glass"></i>◀ dom to edit</p>',
                rightContent: '<p>dom to edit ▶<i class="fa fa-glass"></i>◀</p>',
                leftTest: '<p>◆<i class="fa fa-glass"></i> dom to edit</p>',
                rightTest: '<p>dom to edit <i class="fa fa-glass"></i>◆</p>',
                shiftLeftTest: '<p>◆<i class="fa fa-glass"></i> dom to edit</p>',
                // shiftRightTest: '<p>dom to edit <i class="fa fa-glass"></i>◆</p>',
            },
            // todo: fix LEFT tests (behavior ok but test module can't use native LEFT so we get a false negative)
            {
                repeat: 3,
                name: "through voidoid",
                // leftContent: '<p>dom to <i class="fa fa-glass"></i> ◆edit</p>',
                rightContent: '<p>dom to◆ <i class="fa fa-glass"></i> edit</p>',
                // leftTest: '<p>dom to◆ <i class="fa fa-glass"></i> edit</p>',
                rightTest: '<p>dom to <i class="fa fa-glass"></i> ◆edit</p>',
                // shiftLeftTest: '<p>dom to◆ <i class="fa fa-glass"></i> edit</p>',
                // shiftRightTest: '<p>dom to▶ <i class="fa fa-glass"></i> ◀edit</p>',
            },
            {
                repeat: 2,
                name: "next to voidoid at edge of unbreakable",
                leftContent: '<p><i class="fa fa-glass"></i> ◆dom to edit</p>',
                rightContent: '<p>dom to edit◆ <i class="fa fa-glass"></i></p>',
                leftTest: '<p>◆<i class="fa fa-glass"></i> dom to edit</p>',
                rightTest: '<p>dom to edit <i class="fa fa-glass"></i>◆</p>',
                // shiftLeftTest: '<p>▶<i class="fa fa-glass"></i> ◀dom to edit</p>',
                shiftRightTest: '<p>dom to edit▶ <i class="fa fa-glass"></i>◀</p>',
            },
            {
                name: "on voidoid in table",
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<i class="fa fa-glass"></i>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
                leftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<i class="fa fa-glass"></i></p></td><td><p>yyy</p></td></tr></tbody></table>',
                rightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p><i class="fa fa-glass"></i>◆</p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftLeftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<i class="fa fa-glass"></i></p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftRightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<i class="fa fa-glass"></i>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
            },
            {
                name: "on voidoid in table without spaces",
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<i class="fa fa-glass"></i>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
                leftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<i class="fa fa-glass"></i></p></td><td><p>yyy</p></td></tr></tbody></table>',
                rightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p><i class="fa fa-glass"></i>◆</p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftLeftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<i class="fa fa-glass"></i></p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftRightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<i class="fa fa-glass"></i>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
            },
            {
                name: "on voidoid in table without spaces (2)",
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<i class="fa fa-glass"></i>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
                leftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<i class="fa fa-glass"></i></p></td><td><p>yyy</p></td></tr></tbody></table>',
                rightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p><i class="fa fa-glass"></i>◆</p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftLeftTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>◆<i class="fa fa-glass"></i></p></td><td><p>yyy</p></td></tr></tbody></table>',
                shiftRightTest: '<table><tbody><tr><td><p>xxx</p></td><td><p>▶<i class="fa fa-glass"></i>◀</p></td><td><p>yyy</p></td></tr></tbody></table>',
            },
        ];
        this.mixedTests = [
            /* {
                name: "Back and forth selection through image",
                content: '<p>dom to <img src="/web_editor/static/src/img/transparent.png"/>◆ edit</p>',
                steps: [{
                    key: 'LEFT',
                    shiftKey: true,
                }, {
                    key: 'LEFT',
                    shiftKey: true,
                }, {
                    key: 'RIGHT',
                    shiftKey: true,
                }],
                test: '<p>dom to ▶<img src="/web_editor/static/src/img/transparent.png"/>◀ edit</p>',
            }, */
        ];
    }

    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }

    test (assert) {
        var tests = this._generateTests(this.unitTests)
            .concat(this.mixedTests);
        return this.dependencies.TestKeyboard.test(assert, tests);
    }

    _generateTests (tests) {
        var n = 0;
        return we3.utils.flatMap(tests, function (test) {
            n++;
            var nTimes = test.repeat ? test.repeat + "x" : '';
            var newTests = [];
            var nthTest = "(" + n + ") ";
            // LEFT TESTS
            if ((test.leftContent || test.content) && (test.leftTest || test.test)) {
                newTests.push({
                    name: nthTest + nTimes + "LEFT " + test.name,
                    content: test.leftContent || test.content,
                    steps: Array.from(new Array(test.repeat || 1), function () {
                        return {
                            key: 'LEFT',
                        };
                    }),
                    test: test.leftTest || test.test,
                    testDOM: test.testDOM,
                });
                nthTest = "";
            }
            // RIGHT TESTS
            if ((test.rightContent || test.content) && (test.rightTest || test.test)) {
                newTests.push({
                    name: nthTest + nTimes + "RIGHT " + test.name,
                    content: test.rightContent || test.content,
                    steps: Array.from(new Array(test.repeat || 1), function () {
                        return {
                            key: 'RIGHT',
                        };
                    }),
                    test: test.rightTest || test.test,
                    testDOM: test.testDOM,
                });
                nthTest = "";
            }
            // SHIFT+LEFT TESTS
            if ((test.leftContent || test.content) && (test.shiftLeftTest || test.test)) {
                newTests.push({
                    name: nthTest + nTimes + "SHIFT+LEFT " + test.name,
                    content: test.leftContent || test.content,
                    steps: Array.from(new Array(test.repeat || 1), function () {
                        return {
                            key: 'LEFT',
                            shiftKey: true,
                        };
                    }),
                    test: test.shiftLeftTest || test.test,
                    testDOM: test.testDOM,
                });
                nthTest = "";
            }
            // SHIFT+RIGHT TESTS
            if ((test.rightContent || test.content) && (test.shiftRightTest || test.test)) {
                newTests.push({
                    name: nthTest + nTimes + "SHIFT+RIGHT " + test.name,
                    content: test.rightContent || test.content,
                    steps: Array.from(new Array(test.repeat || 1), function () {
                        return {
                            key: 'RIGHT',
                            shiftKey: true,
                        };
                    }),
                    test: test.shiftRightTest || test.test,
                    testDOM: test.testDOM,
                });
                nthTest = "";
            }
            return newTests;
        });
    }
};

we3.addPlugin('TestKeyboardArrow', TestKeyboardArrow);

})();
