const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    AttachmentBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

const { createCanvas } = require("canvas");

function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCaptcha() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let text = "";
    for (let i = 0; i < 6; i++) text += chars[Math.floor(Math.random() * chars.length)];

    const width  = 300;
    const height = 100;
    const canvas = createCanvas(width, height);
    const ctx    = canvas.getContext("2d");

    
    ctx.fillStyle = "#1e1f22";
    ctx.fillRect(0, 0, width, height);

    
    for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `rgba(${rnd(60, 160)}, ${rnd(60, 160)}, ${rnd(60, 160)}, 0.45)`;
        ctx.fillRect(rnd(0, width), rnd(0, height), 2, 2);
    }

    
    for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = `rgba(${rnd(80, 200)}, ${rnd(80, 200)}, ${rnd(80, 200)}, 0.55)`;
        ctx.lineWidth = rnd(1, 2);
        ctx.beginPath();
        ctx.moveTo(rnd(0, width), rnd(0, height));
        ctx.bezierCurveTo(
            rnd(0, width), rnd(0, height),
            rnd(0, width), rnd(0, height),
            rnd(0, width), rnd(0, height)
        );
        ctx.stroke();
    }

    
    for (let i = 0; i < text.length; i++) {
        const hue = rnd(0, 360);
        ctx.fillStyle = `hsl(${hue}, 80%, 72%)`;
        ctx.font = `bold ${rnd(36, 44)}px monospace`;
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.translate(22 + i * 44, height / 2 + rnd(-10, 10));
        ctx.rotate((Math.random() - 0.5) * 0.55);
        ctx.fillText(text[i], 0, 0);
        ctx.restore();
    }

    
    for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(${rnd(0, 255)}, ${rnd(0, 255)}, ${rnd(0, 255)}, 0.35)`;
        ctx.fillRect(rnd(0, width), rnd(0, height), 2, 2);
    }

    return { buffer: canvas.toBuffer("image/png"), text };
}

module.exports = (client) => {
    if (!client._verifyCaptcha) client._verifyCaptcha = new Map();

    const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

    client.on("interactionCreate", async (interaction) => {

        
        if (interaction.isButton() && interaction.customId === "verify_start") {
            const guildId = interaction.guild?.id;
            if (!guildId) return;

            const cfg = client.lmdbGet(`verify_cfg_${guildId}`);
            if (!cfg) {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Verification is not configured.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            const member = interaction.member;
            if (member.roles.cache.has(cfg.roleId)) {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.enabled2} You are already verified.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            const { buffer, text } = generateCaptcha();
            const captchaKey = `${interaction.user.id}_${guildId}`;

            client._verifyCaptcha.set(captchaKey, {
                answer:  text,
                expires: Date.now() + 5 * 60 * 1000,
            });

            const attachment = new AttachmentBuilder(buffer, { name: "captcha.png" });

            return interaction.reply({
                files: [attachment],
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Captcha Verification")
                        )
                        .addSeparatorComponents(sep())
                        .addMediaGalleryComponents(
                            new MediaGalleryBuilder().addItems(
                                new MediaGalleryItemBuilder().setURL("attachment://captcha.png")
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                "Type the characters shown in the image exactly as they appear.\n-# The code expires in 5 minutes."
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addActionRowComponents(row =>
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`verify_enter_${guildId}`)
                                    .setLabel("Enter Code")
                                    .setStyle(ButtonStyle.Primary)
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2 | 64,
            });
        }

        
        if (interaction.isButton() && interaction.customId.startsWith("verify_enter_")) {
            const guildId    = interaction.customId.slice("verify_enter_".length);
            const captchaKey = `${interaction.user.id}_${guildId}`;
            const data       = client._verifyCaptcha.get(captchaKey);

            if (!data || Date.now() > data.expires) {
                client._verifyCaptcha.delete(captchaKey);
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Your captcha has expired. Click **Verify** again to get a new one.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`verify_modal_${guildId}`)
                .setTitle("Complete Verification")
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("captcha_answer")
                            .setLabel("Enter the code from the image")
                            .setStyle(TextInputStyle.Short)
                            .setMinLength(6)
                            .setMaxLength(6)
                            .setRequired(true)
                            .setPlaceholder("XXXXXX")
                    )
                );

            return interaction.showModal(modal);
        }

        
        if (interaction.isModalSubmit() && interaction.customId.startsWith("verify_modal_")) {
            const guildId    = interaction.customId.slice("verify_modal_".length);
            const captchaKey = `${interaction.user.id}_${guildId}`;
            const data       = client._verifyCaptcha.get(captchaKey);

            if (!data || Date.now() > data.expires) {
                client._verifyCaptcha.delete(captchaKey);
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Your captcha expired. Click **Verify** again to get a new one.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            const answer = interaction.fields.getTextInputValue("captcha_answer").toUpperCase().trim();

            if (answer !== data.answer) {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Incorrect code. Click **Verify** again to get a new captcha.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            
            client._verifyCaptcha.delete(captchaKey);

            const cfg = client.lmdbGet(`verify_cfg_${guildId}`);
            if (!cfg) {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Verification system is not configured. Contact a server admin.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            try {
                await interaction.member.roles.add(cfg.roleId, "Passed captcha verification");
            } catch {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Failed to assign the verified role. Please contact a server admin.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            return interaction.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.enabled2} **Verification complete!**\nYou now have access to the server.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2 | 64,
            });
        }
    });
};
