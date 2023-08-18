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
    for i in range(len(mock_revisions)-1, 0, -1):
        patches.append(generate_patch(mock_revisions[i], mock_revisions[i-1]))

    restored = mock_revisions[-1]
    restored_list = [restored]
    for patch in patches:
        restored = apply_patch(restored, patch)
        restored_list.insert(0, restored)

    for i in range(len(restored_list)):
        print('\n  >>' + str(i) + ' : ' + str(restored_list[i] == mock_revisions[i]))
        print(restored_list[i])
        print(mock_revisions[i])


def compare_one():
    comparison = generate_comparison(mock_revisions[1], mock_revisions[0])
    print(comparison)


def main():
    # print('--------\ndebug_generate_patch')
    # debug_generate_patch()
    # print('--------\nrestore_all')
    # restore_all()
    print('--------\ncompare_one')
    compare_one()


if __name__ == '__main__':
    main()
