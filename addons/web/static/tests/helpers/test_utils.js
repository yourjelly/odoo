odoo.define('web.test_utils', function (require) {
"use strict";

/**
 * Test Utils
 *
 * In this module, we define various utility functions to help simulate a mock
 * environment as close as possible as a real environment.  The main function is
 * certainly createView, which takes a bunch of parameters and give you back an
 * instance of a view, appended in the dom, ready to be tested.
 */

var ajax = require('web.ajax');
var concurrency = require('web.concurrency');
var core = require('web.core');
var relationalFields = require('web.relational_fields');
var session = require('web.session');
var testUtilsCreate = require('web.test_utils_create');
var testUtilsDom = require('web.test_utils_dom');
var testUtilsFields = require('web.test_utils_fields');
var testUtilsFile = require('web.test_utils_file');
var testUtilsForm = require('web.test_utils_form');
var testUtilsGraph = require('web.test_utils_graph');
var testUtilsKanban = require('web.test_utils_kanban');
var testUtilsMock = require('web.test_utils_mock');
var testUtilsModal = require('web.test_utils_modal');
var testUtilsPivot = require('web.test_utils_pivot');
var tools = require('web.tools');


function checkBody () {
    var $bodyChilds = $('body > *');
    var validElements = [
        // Always in the body:
        {tagName: 'DIV', attrToCompare: 'id', value: 'qunit'},
        {tagName: 'DIV', attrToCompare: 'id', value: 'qunit-fixture'},
        {tagName: 'SCRIPT', attrToCompare: 'id', value: ''},
        // Don't must be in the body after a test but tolerate:
        {tagName: 'DIV', attrToCompare: 'className', value: 'tooltip fade bs-tooltip-auto'},
        {tagName: 'DIV', attrToCompare: 'className', value: 'tooltip fade bs-tooltip-auto show'},
        {tagName: 'I', attrToCompare: 'title', value: 'Raphaël Colour Picker'},
    ];
    if ($bodyChilds.length > 3) {
        console.warn(`There are something abnormal in the body`);
        for (var i = 0; i < $bodyChilds.length; i++) {
            var bodyChild = $bodyChilds[i];
            var validate = false;

            for (var j = 0; j < validElements.length; j++) {
                var toleratedElement = validElements[j];
                if (toleratedElement.tagName === bodyChild.tagName) {
                    var attr = toleratedElement.attrToCompare;
                    if (toleratedElement.value === bodyChild[attr]) {
                        validate = true;
                        break;
                    }
                }
            }

            if (!validate) {
                throw new Error (`Body still contains undesirable element (${bodyChild})`);
            }
        }
    }
}

function checkModals () {
    var numberOfModalsOpened = $('.modal').length;
    if ( numberOfModalsOpened > 0) {
        throw new Error (`There are ${numberOfModalsOpened} modal(s) still open after the test`);
    }
}

function deprecated(fn, type) {
    var msg = `Helper 'testUtils.${fn.name}' is deprecated. ` +
        `Please use 'testUtils.${type}.${fn.name}' instead.`;
    return tools.deprecated(fn, msg);
}

/**
 * Helper function, make a promise with a public resolve function. Note that
 * this is not standard and should not be used outside of tests...
 *
 * @returns {Promise + resolve and reject function}
 */
function makeTestPromise() {
    var resolve;
    var reject;
    var promise = new Promise(function (_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
    });
    promise.resolve = function () {
        resolve.apply(null, arguments);
        return promise;
    };
    promise.reject = function () {
        reject.apply(null, arguments);
        return promise;
    };
    return promise;
}

function makeTestPromiseWithAssert(assert, str) {
    var prom = makeTestPromise();
    prom.then(() => assert.step('ok ' + str));
    prom.catch(() => assert.step('ko ' + str));
    return prom;
}

/**
 * Create a new promise that can be waited by the caller in order to execute
 * code after the next microtask tick and before the next jobqueue tick.
 *
 * @return {Promise} an already fulfilled promise
 */
async function nextMicrotaskTick() {
    return Promise.resolve();
}

/**
 * Returns a promise that is resolved in the next jobqueue tick so that the
 *  caller can wait on it in order to execute code in the next jobqueue tick.
 *
 * @return {Promise} a promise that will be fulfilled in the next jobqueue tick
 */
async function nextTick() {
    return concurrency.delay(0);
}

// Loading static files cannot be properly simulated when their real content is
// really needed. This is the case for static XML files so we load them here,
// before starting the qunit test suite.
// (session.js is in charge of loading the static xml bundle and we also have
// to load xml files that are normally lazy loaded by specific widgets).
return Promise.all([
    session.is_bound,
    ajax.loadXML('/web/static/src/xml/dialog.xml', core.qweb)
]).then(function () {
    setTimeout(function () {
        // jquery autocomplete refines the search in a setTimeout() parameterized
        // with a delay, so we force this delay to 0 s.t. the dropdown is filtered
        // directly on the next tick
        relationalFields.FieldMany2One.prototype.AUTOCOMPLETE_DELAY = 0;

        // this is done with the hope that tests are
        // only started all together...
        QUnit.start();
    }, 0);
    return {
        mock: {
            addMockEnvironment: testUtilsMock.addMockEnvironment,
            intercept: testUtilsMock.intercept,
            patch: testUtilsMock.patch,
            patchDate: testUtilsMock.patchDate,
            unpatch: testUtilsMock.unpatch,
            fieldsViewGet: testUtilsMock.fieldsViewGet,
            patchSetTimeout: testUtilsMock.patchSetTimeout,
        },
        dom: {
            triggerKeypressEvent: testUtilsDom.triggerKeypressEvent,
            triggerMouseEvent: testUtilsDom.triggerMouseEvent,
            triggerPositionalMouseEvent: testUtilsDom.triggerPositionalMouseEvent,
            dragAndDrop: testUtilsDom.dragAndDrop,
            openDatepicker: testUtilsDom.openDatepicker,
            click: testUtilsDom.click,
            clickFirst: testUtilsDom.clickFirst,
            clickLast: testUtilsDom.clickLast,
            triggerEvents: testUtilsDom.triggerEvents,
        },
        form: {
            clickEdit: testUtilsForm.clickEdit,
            clickSave: testUtilsForm.clickSave,
            clickCreate: testUtilsForm.clickCreate,
            clickDiscard: testUtilsForm.clickDiscard,
            reload: testUtilsForm.reload,
        },
        graph: {
            reload: testUtilsGraph.reload,
        },
        kanban: {
            reload: testUtilsKanban.reload,
            clickCreate: testUtilsKanban.clickCreate,
            quickCreate: testUtilsKanban.quickCreate,
            toggleGroupSettings: testUtilsKanban.toggleGroupSettings,
            toggleRecordDropdown: testUtilsKanban.toggleRecordDropdown,
        },
        modal: {
            clickButton: testUtilsModal.clickButton,
        },
        pivot: {
            clickMeasure: testUtilsPivot.clickMeasure,
            toggleMeasuresDropdown: testUtilsPivot.toggleMeasuresDropdown,
            reload: testUtilsPivot.reload,
        },
        fields: {
            many2one: {
                clickOpenDropdown: testUtilsFields.clickOpenM2ODropdown,
                clickHighlightedItem: testUtilsFields.clickM2OHighlightedItem,
				clickItem: testUtilsFields.clickM2OItem,
                searchAndClickItem: testUtilsFields.searchAndClickM2OItem,
            },
            editInput: testUtilsFields.editInput,
            editSelect: testUtilsFields.editSelect,
            editAndTrigger: testUtilsFields.editAndTrigger,
            triggerKey: testUtilsFields.triggerKey,
            triggerKeydown: testUtilsFields.triggerKeydown,
            triggerKeyup: testUtilsFields.triggerKeyup,
        },
        file: {
            createFile: testUtilsFile.createFile,
            dragoverFile: testUtilsFile.dragoverFile,
            dropFile: testUtilsFile.dropFile,
        },

        createActionManager: testUtilsCreate.createActionManager,
        createDebugManager: testUtilsCreate.createDebugManager,
        createAsyncView: testUtilsCreate.createAsyncView,
        createControlPanel: testUtilsCreate.createControlPanel,
        createView: testUtilsCreate.createAsyncView,
        createModel: testUtilsCreate.createModel,
        createParent: testUtilsCreate.createParent,
        makeTestPromise: makeTestPromise,
        makeTestPromiseWithAssert: makeTestPromiseWithAssert,
        nextMicrotaskTick: nextMicrotaskTick,
        nextTick: nextTick,
        checkBody: checkBody,
        checkModals: checkModals,

        // backward-compatibility
        addMockEnvironment: deprecated(testUtilsMock.addMockEnvironment, 'mock'),
        dragAndDrop: deprecated(testUtilsDom.dragAndDrop, 'dom'),
        fieldsViewGet: deprecated(testUtilsMock.fieldsViewGet, 'mock'),
        intercept: deprecated(testUtilsMock.intercept, 'mock'),
        openDatepicker: deprecated(testUtilsDom.openDatepicker, 'dom'),
        patch: deprecated(testUtilsMock.patch, 'mock'),
        patchDate: deprecated(testUtilsMock.patchDate, 'mock'),
        triggerKeypressEvent: deprecated(testUtilsDom.triggerKeypressEvent, 'dom'),
        triggerMouseEvent: deprecated(testUtilsDom.triggerMouseEvent, 'dom'),
        triggerPositionalMouseEvent: deprecated(testUtilsDom.triggerPositionalMouseEvent, 'dom'),
        unpatch: deprecated(testUtilsMock.unpatch, 'mock'),
    };
});

});
