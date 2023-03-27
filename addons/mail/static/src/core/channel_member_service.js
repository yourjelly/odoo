/** @odoo-module */

import { registry } from "@web/core/registry";
import { removeFromArray } from "../utils/arrays";
import { ChannelMember } from "./channel_member_model";

export class ChannelMemberService {
    constructor(env, services) {
        this.services = {
            "mail.store": services["mail.store"],
            "mail.persona": services["mail.persona"],
        };
    }

    insert(data) {
        const memberData = Array.isArray(data) ? data[1] : data;
        let member = this.services["mail.store"].channelMembers[memberData.id];
        if (!member) {
            this.services["mail.store"].channelMembers[memberData.id] = new ChannelMember();
            member = this.services["mail.store"].channelMembers[memberData.id];
            member._store = this.services["mail.store"];
        }
        this.update(member, data);
        return member;
    }

    update(member, data) {
        const [command, memberData] = Array.isArray(data) ? data : ["insert", data];
        member.id = memberData.id;
        if ("persona" in memberData) {
            member.persona = this.services["mail.persona"].insert({
                ...(memberData.persona.partner ?? memberData.persona.guest),
                type: memberData.persona.guest ? "guest" : "partner",
                country: memberData.persona.partner?.country,
                channelId: memberData.persona.guest ? memberData.channel.id : null,
            });
        }
        member.threadId = memberData.threadId ?? member.threadId ?? memberData.channel.id;
        switch (command) {
            case "insert":
                {
                    if (!member.thread.channelMembers.includes(member)) {
                        member.thread.channelMembers.push(member);
                    }
                }
                break;
            case "unlink":
                removeFromArray(this.services["mail.store"].channelMembers, member);
            // eslint-disable-next-line no-fallthrough
            case "insert-and-unlink":
                removeFromArray(member.thread.channelMembers, member);
                break;
        }
    }

    async fetchMembers(thread) {
        const known_member_ids = thread.channelMembers.map((channelMember) => channelMember.id);
        const results = await this.rpc("/mail/channel/members", {
            channel_id: thread.id,
            known_member_ids: known_member_ids,
        });
        let channelMembers = [];
        if (
            results["channelMembers"] &&
            results["channelMembers"][0] &&
            results["channelMembers"][0][1]
        ) {
            channelMembers = results["channelMembers"][0][1];
        }
        thread.memberCount = results["memberCount"];
        for (const channelMember of channelMembers) {
            if (channelMember.persona || channelMember.partner) {
                this.insert({ ...channelMember, threadId: thread.id });
            }
        }
    }
}

export const channelMemberService = {
    dependencies: ["mail.store", "mail.persona"],
    start(env, services) {
        return new ChannelMemberService(env, services);
    },
};
registry.category("services").add("mail.channel.member", channelMemberService);
