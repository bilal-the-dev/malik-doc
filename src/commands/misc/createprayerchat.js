const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

const { PRAYER_ROOM_CATEGORY_ID, OWNER_ROLE_ID } = process.env;

const allowedRoleIds = OWNER_ROLE_ID.split(",");

module.exports = {
  name: "createprayerchat",
  description: "Create a private prayer room for a user",
  options: [
    {
      name: "target-user",
      description: "The user to create a prayer room for",
      required: true,
      type: ApplicationCommandOptionType.Mentionable,
    },
  ],
  permissionsRequired: [], // Leave empty if checking roles manually
  botPermissions: [PermissionFlagsBits.ManageChannels],

  callback: async (client, interaction) => {
    const member = interaction.member;
    const targetUser = interaction.options.getMentionable("target-user");

    // Check if user has allowed roles
    if (!member.roles.cache.some((role) => allowedRoleIds.includes(role.id))) {
      return interaction.reply({
        content: "❌ You don't have permission to use this command.",
        ephemeral: true,
      });
    }

    if (!targetUser || !targetUser.user) {
      return interaction.reply({
        content: "⚠️ Please select a valid user.",
        ephemeral: true,
      });
    }

    const userName = targetUser.user.username
      .toLowerCase()
      .replace(/\s+/g, "-");
    const channelName = `prayer-room-${userName}`;

    try {
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: PRAYER_ROOM_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: targetUser.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
          ...allowedRoleIds.map((roleId) => ({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          })),
        ],
      });

      await channel.send({
        content: `🕊️ Welcome <@${targetUser.id}>. This room has been created for private prayer and support.`,
      });

      const embed = new EmbedBuilder()
        .setTitle("🙏 Private Prayer Room Created")
        .setDescription(
          `Channel <#${channel.id}> created for <@${targetUser.id}>.`
        )
        .setColor(0x6c5ce7);

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Prayer room error:", err.message);
      return interaction.reply({
        content: "⚠️ Failed to create the prayer room.",
        ephemeral: true,
      });
    }
  },
};
