const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const ChannelRequest = require("../../models/ChannelRequest");
const { CHANNEL_APPROVAL_CHANNEL_ID, MODERATOR_ROLE_ID, OWNER_ROLE_ID } =
  process.env;
const leaderRoles = MODERATOR_ROLE_ID.split(",");

module.exports = {
  name: "requestchannel",
  description: "Request a new channel (owner approval required)",
  options: [
    {
      name: "name",
      description: "Channel name",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "type",
      description: "Channel type",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: "Text", value: "text" },
        { name: "Voice", value: "voice" },
      ],
      required: true,
    },
    {
      name: "visibility",
      description: "Channel visibility",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: "Public", value: "public" },
        { name: "Private", value: "private" },
      ],
      required: true,
    },
    {
      name: "category",
      description: "Select the category where the channel should be created",
      type: ApplicationCommandOptionType.Channel,
      channel_types: [ChannelType.GuildCategory],
      required: true,
    },
  ],
  permissionsRequired: [],
  botPermissions: [PermissionFlagsBits.ManageChannels],

  callback: async (client, interaction) => {
    const member = interaction.member;
    if (!member.roles.cache.some((r) => leaderRoles.includes(r.id))) {
      return interaction.reply({
        content: "❌ You don't have permission to request channels.",
        ephemeral: true,
      });
    }

    const name = interaction.options.getString("name");
    const type = interaction.options.getString("type");
    const visibility = interaction.options.getString("visibility");
    const categoryChannel = interaction.options.getChannel("category");
    const categoryId = categoryChannel.id;
    const categoryName = categoryChannel.name;

    const request = await ChannelRequest.create({
      requestedBy: interaction.user.id,
      name,
      type,
      visibility,
      categoryId,
    });

    const embed = new EmbedBuilder()
      .setTitle("📢 New Channel Request")
      .setDescription(
        `A new channel has been requested by <@${interaction.user.id}>.`,
      )
      .addFields({
        name: "📌 Channel Info",
        value: `\`\`\`Name       : ${name}
Type       : ${type}
Visibility : ${visibility}
Category   : ${categoryName}\`\`\``,
      })
      .setColor("Yellow")
      .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 1024 }));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`channelbtn_approve_${request._id}`)
        .setLabel("✅ Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`channelbtn_deny_${request._id}`)
        .setLabel("❌ Deny")
        .setStyle(ButtonStyle.Danger),
    );

    const approvalChannel = await client.channels.fetch(
      CHANNEL_APPROVAL_CHANNEL_ID,
    );
    await approvalChannel.send({
      content: `<@&${OWNER_ROLE_ID}>`,
      embeds: [embed],
      components: [row],
    });

    return interaction.reply({
      content: "✅ Channel request submitted for approval.",
      ephemeral: true,
    });
  },
};
