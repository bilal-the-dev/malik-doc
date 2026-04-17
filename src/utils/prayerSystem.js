const { Events, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const cron = require("node-cron");
const UserInvite = require("../models/UserInvite");

const {
  BROTHERS_PRAY_CHANNEL_ID,
  SISTERS_PRAY_CHANNEL_ID,
  PRAYER_REQUESTS_CHANNEL_ID,
  GUILD_ID,
} = process.env;

// Helper: Is the channel one of the prayer channels?
function isPrayerChannel(channelId) {
  return (
    channelId === BROTHERS_PRAY_CHANNEL_ID ||
    channelId === SISTERS_PRAY_CHANNEL_ID ||
    channelId === PRAYER_REQUESTS_CHANNEL_ID
  );
}

// 🧠 Triggered when someone engages (reacts or replies)
async function handleEngagement(member, channel) {
  const now = new Date();
  const extension = 15 * 60 * 1000; // 15 minutes
  const newExpiresAt = new Date(now.getTime() + extension);
  const channelId = channel.id;

  let user = await UserInvite.findOne({ discordId: member.id });

  // Initialize user if not exists
  if (!user) {
    user = new UserInvite({
      discordId: member.id,
    });
    await user.save();
  }

  // Check if user already has access to THIS specific channel
  const currentWindow = user.engagement?.prayerWindows?.get(channelId);

  if (currentWindow && currentWindow.expiresAt > now) {
    // User already has access to this channel - send message
    const alreadyUnlockedEmbed = new EmbedBuilder()
      .setTitle("🔓 Channel Already Unlocked")
      .setDescription(
        `You already have access to this prayer channel.\nTime remaining: ${Math.ceil(
          (currentWindow.expiresAt - now) / (60 * 1000)
        )} minutes`
      )
      .setColor(0xf39c12);

    await member.send({ embeds: [alreadyUnlockedEmbed] }).catch(() =>
      channel.send({
        content: `<@${member.id}>`,
        embeds: [alreadyUnlockedEmbed],
      })
    );

    return; // Don't extend time or grant new permissions
  }

  // Grant permission for THIS channel only
  await channel.permissionOverwrites.edit(member.id, {
    SendMessages: true,
  });

  const embed = new EmbedBuilder()
    .setTitle("🙏 Prayer Window Opened")
    .setDescription(
      `You have 15 minutes to post a prayer in this channel.\nThank you for supporting others.`
    )
    .setColor(0x00b894);

  await member
    .send({ embeds: [embed] })
    .catch(() => channel.send({ content: `<@${member.id}>`, embeds: [embed] }));

  // Update the database with per-channel tracking
  await UserInvite.updateOne(
    { discordId: member.id },
    {
      $set: {
        [`engagement.prayerWindows.${channelId}.expiresAt`]: newExpiresAt,
      },
      $inc: {
        [`engagement.prayerWindows.${channelId}.count`]: 1,
        "engagement.totalPrayerCount": 1,
      },
    }
  );

  console.log(
    `🙏 Prayer access granted to ${member.user.tag} for channel ${channel.name}`
  );
}

module.exports = {
  handleEngagement,
  isPrayerChannel,
};
