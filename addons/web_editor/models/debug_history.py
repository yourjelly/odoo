# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from patch_utils import generate_patch, generate_comparison, apply_patch


mock_revisions = [
    "<p>foo</p><p>bar</p><p>baz</p><p>bax</p>",
    "<p>foo</p><p>baz</p><p>bax</p>",
    "<p>foo</p><p>bar</p><p>baz</p><p>bax</p>",
    "<p>foo</p><p>baz</p>",
    "<b>fo++o</b><p>b++ar</p>",
    "",
    "<p>foo</p><p>bar</p><p>baz</p><p>bax</p>",
    "<p>foo</p><p>ba++r</p><p>baz</p><p>b++ax</p>",
    "<p>foo</p><p>bar</p><p>baz</p><p>bax</p>",
    "<i>xxx</i>",
    "<p>ra<b>nd<b>om</p>",
]


def debug_generate_patch():
    custom_diff = generate_patch(mock_revisions[1], mock_revisions[0])
    print(custom_diff)
    custom_diff = generate_patch(mock_revisions[2], mock_revisions[3])
    print(custom_diff)


def restore_all():
    patches = []
    for i in range(len(mock_revisions)-1, 1, -1):
        patches.append(generate_patch(mock_revisions[i], mock_revisions[i-1]))

    restored = mock_revisions[-1]
    for patch in patches:
        print('--------\napply_patch loop')
        print('before :')
        print(restored)
        restored = apply_patch(restored, patch)
        print('after :')
        print(restored)


def main():
    # print('--------\ndebug_generate_patch')
    # debug_generate_patch()
    print('--------\nrestore_all')
    restore_all()


if __name__ == '__main__':
    main()
