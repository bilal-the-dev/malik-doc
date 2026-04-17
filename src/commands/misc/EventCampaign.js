const {
  ApplicationCommandOptionType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  name: "schedulecampaign",
  description: "Schedule a campaign with up to 5 timed messages",
  options: [
    {
      name: "name",
      description: "Campaign name",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "channel",
      description: "Channel to send the messages in",
      type: ApplicationCommandOptionType.Channel,
      required: true,
    },
  ],

  callback: async (client, interaction) => {
    const name = interaction.options.getString("name");
    const channel = interaction.options.getChannel("channel");

    const modal = new ModalBuilder()
      .setCustomId(`campaignModal_${channel.id}_${name}`)
      .setTitle("📝 Schedule Campaign (Up to 5)");

    for (let i = 1; i <= 5; i++) {
      const input = new TextInputBuilder()
        .setCustomId(`message${i}`)
        .setLabel(`Message ${i} (YYYY-MM-DD HH:mm | content)`)
        .setPlaceholder(`Ex: 2026-03-07 19:45 | Test (UTC+)`)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(i === 1); // only message1 is required

      modal.addComponents(new ActionRowBuilder().addComponents(input));
    }

    await interaction.showModal(modal);
  },
};
