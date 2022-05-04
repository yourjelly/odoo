/** @odoo-module */

export function openCommandBar(paragraph) {
    const sel = document.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.setEnd(paragraph, 0);
    sel.addRange(range);
    paragraph.dispatchEvent(new KeyboardEvent('keydown', {
        key: '/',
    }));
    const slash = document.createTextNode('/');
    paragraph.replaceChildren(slash);
    sel.removeAllRanges();
    range.setStart(paragraph, 1);
    range.setEnd(paragraph, 1);
    sel.addRange(range);
    paragraph.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: '/',
        bubbles: true,
    }));
    paragraph.dispatchEvent(new KeyboardEvent('keyup', {
        key: '/',
    }));
}

export async function applyCommand(paragraph, command) {
    openCommandBar(paragraph);
    await new Promise(resolve => {
        window.requestAnimationFrame(resolve);
    });
    const sel = document.getSelection();
    const commandNode = document.createTextNode(command);
    paragraph.replaceChildren(commandNode);
    sel.removeAllRanges();
    const range = document.createRange();
    range.setStart(paragraph, 1);
    range.setEnd(paragraph, 1);
    sel.addRange(range);
    paragraph.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'e',
        bubbles: true,
    }));
    await new Promise(resolve => {
        window.requestAnimationFrame(resolve);
    });
    paragraph.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
    }));
}

export function saveArticle(callback = () => {}) {
    const $editable = $('[name="body"] > .odoo-editor-editable');
    $editable.one('blur', () => {
        setTimeout(callback);
    });
    $editable[0].dispatchEvent(new FocusEvent('blur', {
        bubbles: true,
    }));
}

export async function selectArticleLink(name, helper, $select2ChooseArticleLink) {
    helper.click($select2ChooseArticleLink);
    await new Promise(resolve => {
        window.requestAnimationFrame(resolve);
    });
    const $input = $('input[role="combobox"]');
    helper.text(`${name}`, $input);
    const $target = $('.select2-results');
    const observed = (_, observer) => {
        if ($target.find(`:contains(${name})`)) {
            observer.disconnect();
            helper.click($(`div[role="option"]:contains(${name})`));
        }
    };
    const observer = new MutationObserver(observed);
    observer.observe($target[0], { childList: true });
}

export function createArticle(name) {
    return [
        {
            trigger: '.o_section_header:contains(Workspace)',
            content: 'create an article',
            run: function () {
                $('.o_section_header:contains(Workspace) > .o_section_create').click();
            }
        }, {
            trigger: '.o_article_name:contains(New Article)',
            content: 'check that the article was created',
        }, {
            trigger: '.o_breadcrumb_article_name',
            content: 'edit the name of the article',
            run: `text ${name}`,
        }, {
            trigger: `.o_article_name:contains(${name})`,
            content: 'check that the name was correctly modified',
        }, {
            trigger: '.o-main-components-container:not(:has(.o_loading_indicator))',
            content: 'await the page reloading',
        },
    ];
}

export function searchCommandPaletteArticle(name) {
    return [
        {
            trigger: '.o_Chatter button:has(i.fa-book)',
            content: 'click on knowledge command palette',
            run: 'click',
        }, {
            trigger: '.o_command_palette_search > input',
            content: 'search the correct article',
            run: `text ${name}`,
        }, {
            trigger: `.o_command:contains(${name})`,
            content: 'click on the article',
            run: 'click',
        },
    ];
}
