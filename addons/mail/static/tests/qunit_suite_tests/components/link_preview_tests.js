/** @odoo-module **/

import {
    afterNextRender,
    start,
    startServer,
} from '@mail/../tests/helpers/test_utils';

QUnit.module('mail', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('link_preview_tests.js');

const link_preview_gif_payload = {
    og_description: 'test description',
    og_image: 'https://c.tenor.com/B_zYdea4l-4AAAAC/yay-minions.gif',
    og_mimetype: 'image/gif',
    og_title: 'Yay Minions GIF - Yay Minions Happiness - Discover & Share GIFs',
    og_type: 'video.other',
    source_url: 'https://tenor.com/view/yay-minions-happiness-happy-excited-gif-15324023',
};
const link_preview_card_payload = {
    og_description: 'Description',
    og_title: 'Article title',
    og_type: 'article',
    source_url: 'https://www.odoo.com',
};
const link_preview_card_image_payload = {
    og_description: 'Description',
    og_image: 'https://c.tenor.com/B_zYdea4l-4AAAAC/yay-minions.gif',
    og_title: 'Article title',
    og_type: 'article',
    source_url: 'https://www.odoo.com',
};
const link_preview_video_payload = {
    og_description: 'Description',
    og_image: 'https://c.tenor.com/B_zYdea4l-4AAAAC/yay-minions.gif',
    og_title: 'video title',
    og_type: 'video.other',
    source_url: 'https://www.odoo.com',
};
const link_preview_image_payload = {
    og_image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Siberischer_tiger_de_edit02.jpg/290px-Siberischer_tiger_de_edit02.jpg',
    og_title: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Siberischer_tiger_de_edit02.jpg/290px-Siberischer_tiger_de_edit02.jpg',
    og_type: 'image',
    source_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Siberischer_tiger_de_edit02.jpg/290px-Siberischer_tiger_de_edit02.jpg',
};

QUnit.test('auto layout with link preview list', async function (assert) {
    assert.expect(1);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_gif_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    assert.containsOnce(
        document.body,
        '.o_Message .o_LinkPreviewList',
        "Should have a link preview list in the DOM"
    );
});

QUnit.test('auto layout with link preview', async function (assert) {
    assert.expect(1);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_gif_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    assert.containsOnce(
        document.body,
        '.o_LinkPreviewGif',
        "Should have a link preview gif in the DOM"
    );
});

QUnit.test('simplest card layout', async function (assert) {
    assert.expect(3);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_card_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    assert.containsOnce(
        document.body,
        '.o_LinkPreviewCard',
        "should have link preview in DOM"
    );
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewCard_title',
        "Should display the link preview title"
    );
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewCard_description',
        "Link preview should show the link description"
    );
});

QUnit.test('simplest card layout with image', async function (assert) {
    assert.expect(4);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_card_image_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    assert.containsOnce(
        document.body,
        '.o_LinkPreviewCard',
        "should have link preview in DOM"
    );
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewCard_title',
        "Should display the link preview title"
    );
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewCard_description',
        "Link preview should show the link description"
    );
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewCard_image',
        "Should display an image inside the link preview card"
    );
});

QUnit.test('Link preview video layout', async function (assert) {
    assert.expect(4);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_video_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    assert.containsOnce(
        document.body,
        '.o_LinkPreviewVideo',
        "should have link preview video in DOM"
    );
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewVideo_title',
        "Should display the link preview title"
    );
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewVideo_description',
        "Link preview should show the link description"
    );
    assert.containsOnce(
        document.body,
        '.o_linkPreviewVideo_overlay',
        "Should display overlay inside the link preview video image"
    );
});

QUnit.test('Link preview image layout', async function (assert) {
    assert.expect(1);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_image_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    assert.containsOnce(
        document.body,
        '.o_LinkPreviewImage',
        "should have link preview image"
    );
});

QUnit.test('Remove link preview Gif', async function (assert) {
    assert.expect(1);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_gif_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss, click } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    await afterNextRender(() => {
        document
            .querySelector('.o_LinkPreviewGif')
            .dispatchEvent(new window.MouseEvent('mouseenter'));
    });
    await click('.o_LinkPreviewAside');
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewDeleteConfirm',
        'Should have a link preview confirmation dialog'
    );
});

QUnit.test('Remove link preview card image', async function (assert) {
    assert.expect(1);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_card_image_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss, click } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    await afterNextRender(() => {
        document
            .querySelector('.o_LinkPreviewCard')
            .dispatchEvent(new window.MouseEvent('mouseenter'));
    });
    await click('.o_LinkPreviewAside');
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewDeleteConfirm',
        'Should have a link preview confirmation dialog'
    );
});

QUnit.test('Remove link preview card', async function (assert) {
    assert.expect(1);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_card_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss, click } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    await afterNextRender(() => {
        document
            .querySelector('.o_LinkPreviewCard')
            .dispatchEvent(new window.MouseEvent('mouseenter'));
    });
    await click('.o_LinkPreviewAside');
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewDeleteConfirm',
        'Should have a link preview confirmation dialog'
    );
});

QUnit.test('Remove link preview video', async function (assert) {
    assert.expect(1);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_video_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss, click } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    await afterNextRender(() => {
        document
            .querySelector('.o_LinkPreviewVideo')
            .dispatchEvent(new window.MouseEvent('mouseenter'));
    });
    await click('.o_LinkPreviewAside');
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewDeleteConfirm',
        'Should have a link preview confirmation dialog'
    );
});

QUnit.test('Remove link preview image', async function (assert) {
    assert.expect(1);

    const pyEnv = await startServer();
    const linkPreviewId = pyEnv['mail.link.preview'].create(link_preview_image_payload);
    const mailChannelId = pyEnv['mail.channel'].create({});
    pyEnv['mail.message'].create({
        body: 'not empty',
        link_preview_ids: [linkPreviewId],
        message_type: 'comment',
        model: "mail.channel",
        res_id: mailChannelId,
    });
    const { openDiscuss, click } = await start({
        discuss: {
            params: {
                default_active_id: `mail.channel_${mailChannelId}`,
            },
        },
    });
    await openDiscuss();

    await afterNextRender(() => {
        document
            .querySelector('.o_LinkPreviewImage')
            .dispatchEvent(new window.MouseEvent('mouseenter'));
    });
    await click('.o_LinkPreviewAside');
    assert.containsOnce(
        document.body,
        '.o_LinkPreviewDeleteConfirm',
        'Should have a link preview confirmation dialog'
    );
});


});
});
