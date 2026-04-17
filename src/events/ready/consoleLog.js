const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const mongoose = require("mongoose");
const cron = require("node-cron");
const UserInvite = require("../../models/UserInvite");
const EventCampaign = require("../../models/EventCampaign");
const WeeklyEvent = require("../../models/WeeklyEvent");
module.exports = async (client) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log(`${client.user.tag} is online.`);
    console.log("MongoDB connected successfully");

    cron.schedule("* * * * *", async () => {
      const now = new Date();
      try {
        // Find all users with prayer windows
        const usersWithWindows = await UserInvite.find({
          "engagement.prayerWindows": { $exists: true, $ne: {} },
        });

        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const prayerChannels = [
          process.env.BROTHERS_PRAY_CHANNEL_ID,
          process.env.SISTERS_PRAY_CHANNEL_ID,
          process.env.PRAYER_REQUESTS_CHANNEL_ID,
        ];

        for (const user of usersWithWindows) {
          const member = await guild.members
            .fetch(user.discordId)
            .catch(() => null);
          if (!member) continue;

          let hasExpiredWindows = false;
          const updatedWindows = new Map();

          // Check each channel window for this user
          for (const [channelId, windowData] of user.engagement.prayerWindows) {
            if (windowData.expiresAt && windowData.expiresAt <= now) {
              // Window expired - revoke permission for this specific channel
              const channel = await client.channels
                .fetch(channelId)
                .catch(() => null);

              if (channel && prayerChannels.includes(channelId)) {
                await channel.permissionOverwrites.edit(member.id, {
                  SendMessages: false,
                });

                console.log(
                  `🕊️ Revoked prayer access for ${member.user.tag} in channel ${channel.name}`
                );

                // Send notification about this specific channel
                const timeoutEmbed = new EmbedBuilder()
                  .setTitle("⏱️ Prayer Window Closed")
                  .setDescription(
                    `Your 15-minute window for **${channel.name}** has ended.\nReact or reply again in that channel to open a new window.`
                  )
                  .setColor(0xd63031);

                await member.send({ embeds: [timeoutEmbed] }).catch(() => {});
              }
              hasExpiredWindows = true;
            } else if (windowData.expiresAt && windowData.expiresAt > now) {
              // Window still active - keep it
              updatedWindows.set(channelId, windowData);
            }
          }

          // Update database - remove expired windows
          if (hasExpiredWindows) {
            const updateObj = {};

            // Convert Map to plain object for MongoDB
            for (const [channelId, windowData] of updatedWindows) {
              updateObj[`engagement.prayerWindows.${channelId}`] = windowData;
            }

            // Remove expired windows and update with active ones
            await UserInvite.updateOne(
              { discordId: user.discordId },
              {
                $unset: { "engagement.prayerWindows": "" },
                $set: updateObj,
              }
            );
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    // Campaign Message Sender Cron Job
    // Simple Campaign Cron Job
    cron.schedule("* * * * *", async () => {
      const now = new Date();

      try {
        const campaigns = await EventCampaign.find({
          messages: {
            $elemMatch: {
              sent: false,
              sendAt: { $lte: now },
            },
          },
        });

        for (const campaign of campaigns) {
          const channel = await client.channels
            .fetch(campaign.channelId)
            .catch(() => null);
          if (!channel) continue;

          let changed = false;

          for (let i = 0; i < campaign.messages.length; i++) {
            const msg = campaign.messages[i];

            if (!msg.sent && msg.sendAt <= now) {
              try {
                const embed = new EmbedBuilder()
                  .setTitle(`📢 ${campaign.name}`)
                  .setDescription(msg.content)
                  .setColor("Gold");
                await channel.send({ embeds: [embed] });

                campaign.messages[i].sent = true;
                changed = true;
                console.log(`📢 Sent message for campaign ${campaign.name}`);
              } catch (err) {
                console.error(
                  "❌ Failed to send campaign message:",
                  err.message
                );
              }
            }
          }

          if (changed) {
            await campaign.save();
          }
        }
      } catch (err) {
        console.error("❌ Campaign Cron Job Error:", err.message);
      }
    });

    function getCurrentDayTime() {
      const now = new Date();
      const day = now.toLocaleDateString("en-US", { weekday: "long" }); // e.g. Friday
      const time = now.toTimeString().slice(0, 5); // HH:mm
      return { day, time };
    }

    cron.schedule("* * * * *", async () => {
      const { day, time } = getCurrentDayTime();
      const now = new Date();

      const events = await WeeklyEvent.find({
        day,
        time,
        skipNext: { $ne: true },
      });

      for (const event of events) {
        if (
          event.lastSentAt &&
          new Date(event.lastSentAt).toDateString() === now.toDateString()
        ) {
          continue; // already sent today
        }

        const channel = await client.channels
          .fetch(event.channelId)
          .catch(() => null);
        if (!channel) continue;

        const components = event.includeRSVP
          ? [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`rsvp_yes_${event.name}`)
                  .setLabel("✅ I'm coming")
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId(`rsvp_no_${event.name}`)
                  .setLabel("❌ Can't make it")
                  .setStyle(ButtonStyle.Danger)
              ),
            ]
          : [];

        await channel.send({
          content: `📢 **${event.name} is happening soon!**\nReply or RSVP below.`,
          components,
        });

        event.lastSentAt = now;
        event.skipNext = false;
        await event.save();
      }
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1); // Exit process with failure
  }
};
