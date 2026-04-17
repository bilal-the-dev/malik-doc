const {
  ApplicationCommandOptionType,
  ChannelType,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const WeeklyEvent = require("../../models/WeeklyEvent");

module.exports = {
  name: "scheduleweekly",
  description: "Schedule a recurring weekly event reminder.",
  options: [
    {
      name: "name",
      type: ApplicationCommandOptionType.String,
      description: "Unique name for this event",
      required: true,
    },
    {
      name: "day",
      type: ApplicationCommandOptionType.String,
      description: "Day of the week to send",
      required: true,
      choices: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ].map((d) => ({ name: d, value: d })),
    },
    {
      name: "time",
      type: ApplicationCommandOptionType.String,
      description: "Time (24h format, e.g. 13:00)",
      required: true,
    },
    {
      name: "channel",
      type: ApplicationCommandOptionType.Channel,
      description: "Channel to send reminder",
      required: true,
    },
    {
      name: "include-rsvp",
      type: ApplicationCommandOptionType.Boolean,
      description: "Include RSVP buttons?",
      required: false,
    },
  ],

  permissionsRequired: [PermissionFlagsBits.ManageChannels],

  callback: async (client, interaction) => {
    const name = interaction.options.getString("name");
    const day = interaction.options.getString("day");
    const time = interaction.options.getString("time");
    const channel = interaction.options.getChannel("channel");
    const includeRSVP = interaction.options.getBoolean("include-rsvp") || false;

    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: "❌ Please select a text channel.",
        ephemeral: true,
      });
    }

    const exists = await WeeklyEvent.findOne({ name });
    if (exists) {
      return interaction.reply({
        content: "❌ An event with this name already exists.",
        ephemeral: true,
      });
    }

    await WeeklyEvent.create({
      name,
      day,
      time,
      channelId: channel.id,
      createdBy: interaction.user.id,
      includeRSVP,
    });

    return interaction.reply({
      content: `✅ Weekly event **${name}** scheduled for **${day} @ ${time}** in <#${channel.id}>.`,
      ephemeral: true,
    });
  },
};
