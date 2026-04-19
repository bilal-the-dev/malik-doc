const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");

module.exports = {
  name: "setup",
  description: "Sends the rules and welcome embeds",

  callback: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const rulesChannelId = process.env.RULES_CHANNEL_ID;
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;

    const rulesChannel = await client.channels
      .fetch(rulesChannelId)
      .catch(() => null);

    const welcomeChannel = await client.channels
      .fetch(welcomeChannelId)
      .catch(() => null);

    if (!rulesChannel || rulesChannel.type !== ChannelType.GuildText) {
      return interaction.editReply("❌ Could not find a valid rules channel.");
    }

    if (!welcomeChannel || welcomeChannel.type !== ChannelType.GuildText) {
      return interaction.editReply(
        "❌ Could not find a valid welcome channel.",
      );
    }

    // RULES EMBED
    const rulesEmbed = new EmbedBuilder()
      .setTitle("📜 Server Rules")
      .setColor("Orange")
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setDescription(
        "**Please read the following rules carefully before interacting in the server:**\n\n" +
          "1️⃣ Be respectful to everyone.\n" +
          "2️⃣ No spamming, flooding, or self-promotion.\n" +
          "3️⃣ Keep conversations in appropriate channels.\n" +
          "4️⃣ No NSFW or offensive content.\n" +
          "5️⃣ Do not share private information.\n" +
          "6️⃣ Follow Discord's [Community Guidelines](https://discord.com/guidelines).\n\n" +
          "By clicking the button below, you agree to follow these rules.",
      )
      .setFooter({
        text: `${interaction.guild.name} • Rule Confirmation`,
        iconURL: interaction.guild.iconURL({ dynamic: true }),
      })
      .setTimestamp();

    const rulesRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_rules")
        .setLabel("✅ I Accept")
        .setStyle(ButtonStyle.Success),
    );

    await rulesChannel.send({
      embeds: [rulesEmbed],
      components: [rulesRow],
    });

    const welcomeEmbed = new EmbedBuilder()
      .setTitle("👋 Welcome to the Server!")
      .setColor("#00FF00")
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setDescription(
        `Welcome to **${interaction.guild.name}**!\n\n` +
          "We're excited to have you here. Before you start chatting, please take a moment to read our short introduction.\n\n" +
          "**About this server:**\n" +
          "• A place to connect with others\n" +
          "• Share knowledge and ideas\n" +
          "• Participate in discussions and events\n\n" +
          "**Once you have read the introduction, click the button below to continue.**\n\n" +
          "────────────────────\n\n" +
          "📜 **Once you have read the intro & clicked continue**, please go to the **Family Rules** channel:\n" +
          `${rulesChannel ? `<#${rulesChannel.id}>` : "**#family-rules**"}`,
      )
      .setFooter({
        text: `${interaction.guild.name} • Welcome`,
        iconURL: interaction.guild.iconURL({ dynamic: true }),
      });

    const welcomeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("readIntroContinue")
        .setLabel("🙋🏽‍♂️ I Read The Intro - Continue!")
        .setStyle(ButtonStyle.Primary),
    );

    await welcomeChannel.send({
      embeds: [welcomeEmbed],
      components: [welcomeRow],
    });

    await interaction.editReply("✅ Rules and Welcome embeds have been sent.");
  },
};
