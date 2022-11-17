/** @odoo-module **/

import { makeDeferred } from "@web/../tests/helpers/utils";

import {
    start,
    startServer,
} from '@mail/../tests/helpers/test_utils';

import { patch, unpatch } from "@web/core/utils/patch";

QUnit.test('Mailing Notification Sent', async function (assert) {
    assert.timeout(5000);
    assert.expect(7);

    const pyEnv = await startServer();
    const threadId = pyEnv['res.partner'].create([{}, { name: 'Someone', partner_share: true }])[0];
    const mailingId = pyEnv['mailing.mailing'].create({
        subject: 'Test',
        email_from: 'sender@test.lan',
        schedule_type: 'now',
        mailing_type: 'mail',
    });
    const mailMessageId = pyEnv['mail.message'].create({
        body: 'not empty',
        message_type: 'email',
        model: 'res.partner',
        res_id: threadId,
    });
    pyEnv['mailing.trace'].create({
        mail_message_id: mailMessageId,
        trace_type: 'mail',
        trace_status: 'sent',
        email: 'trace@test.lan',
        mass_mailing_id: mailingId,
    });

    const { click, openView } = await start();
    await openView({
        res_id: threadId,
        res_model: 'res.partner',
        views: [[false, 'form']],
    });
    assert.containsOnce(
        document.body,
        '.o-mail-Message-notification.cursor-pointer i[role="img"]',
        'Should display the notification icon'
    );
    assert.containsOnce(
        document.body,
        '.o-mail-Message-notification .fa-envelope-o',
        'Should display a successful delivery icon'
    )

    await click('.o-mail-Message-notification.cursor-pointer');
    assert.containsOnce(
        document.body,
        '.o-mail-MessageNotificationPopover',
        "notification popover should be open"
    );
    assert.containsOnce(
        document.body,
        '.o_MessageNotificationPopoverContentView_notificationIcon',
        "popover should have 1 icon"
    );
    assert.hasClass(
        document.querySelectorAll('.o_MessageNotificationPopoverContentView_notificationIcon'),
        'fa-check',
        "popover should have the sent icon"
    );

    assert.containsOnce(
        document.body,
        '.o_MessageNotificationPopoverContentView_notificationTraceEmail',
        "popover should have the trace email"
    );
    assert.strictEqual(
        document.querySelector('.o_MessageNotificationPopoverContentView_notificationTraceEmail').textContent.trim(),
        "trace@test.lan",
        "trace email should be correct"
    );
});

// any of the traces indicates the mail was not received
QUnit.test('Mailing Notification Mailing Error', async function (assert) {
    // trace values to check against
    const states = [{trace_status: 'error', failure_type: 'mail_smtp'},
                    {trace_status: 'bounce', failure_type: ''},
                    {trace_status: 'cancel', failure_type: ''}];

    assert.timeout(5000);
    assert.expect(7 * states.length);

    const pyEnv = await startServer();
    const threadId = pyEnv['res.partner'].create([{}, { name: 'Someone', partner_share: true }])[0];
    const mailingId = pyEnv['mailing.mailing'].create({
        subject: 'Test',
        email_from: 'sender@test.lan',
        schedule_type: 'now',
        mailing_type: 'mail',
    });
    const mailMessageId = pyEnv['mail.message'].create({
        body: 'not empty',
        message_type: 'email',
        model: 'res.partner',
        res_id: threadId,
    });
    const traceId = pyEnv['mailing.trace'].create({
        email: 'trace@test.lan',
        failure_type: '',
        mail_message_id: mailMessageId,
        mass_mailing_id: mailingId,
        trace_type: 'mail',
        trace_status: 'bounce',
    });

    const { env, openView } = await start();

    for (let i = 0; i < states.length; i++) {
        pyEnv['mailing.trace'].write([traceId], states[i]);
        await openView({
            res_id: threadId,
            res_model: 'res.partner',
            views: [[false, 'form']],
        });
        const openMailingActionDef = makeDeferred();
        patch(env.services.action, '__test_mailing_notification_mailing_error_openMailing_patch', {
            doAction(action, options) {
                //rely on assert.expect to ensure it is triggered for each state
                if (action.res_model !== 'res.partner') {
                    assert.step(`do_action_${i}`);
                    assert.strictEqual(action.type, 'ir.actions.act_window', "Should open a window");
                    assert.strictEqual(action.res_model, 'mailing.mailing', "Should open a mailing");
                    assert.strictEqual(action.res_id, mailingId, "Should open the right mailing");
                    openMailingActionDef.resolve();
                }
            },
        });

        assert.containsOnce(
            document.body,
            '.o-mail-Message-notification.cursor-pointer i[role="img"]',
            'Should display the notification icon'
        );
        assert.containsOnce(
            document.body,
            '.o-mail-Message-notification.text-danger .fa-envelope',
            'Should display a failed delivery icon'
        )
        document.querySelector('.o-mail-Message-notification.cursor-pointer').click();
        await openMailingActionDef;
        assert.verifySteps(
            [`do_action_${i}`],
            'Should do an action to display the mailing'
        );
        unpatch(env.services.action, '__test_mailing_notification_mailing_error_openMailing_patch');
    }
});
