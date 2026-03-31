const moment = require('moment');
require('moment-duration-format');
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

module.exports = {
    name: 'uptime',
    aliases: ['upt'],
    description: "Check how long the bot has been online",
    category: 'info',
    cooldown: 3,
    run: async (client, message) => {
        const time = moment.duration(client.uptime).format('D[d] H[h] m[m] s[s]');
        return message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `⏱️ **Uptime:** \`${time}\``
                    )),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    }
};
