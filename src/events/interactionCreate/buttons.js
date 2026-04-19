const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const UserInvite = require("../../models/UserInvite");
const axios = require("axios");
const ChannelRequest = require("../../models/ChannelRequest");
const User = require("../../models/User");
module.exports = async (client, interaction) => {
  try {
    if (!interaction.isButton()) return;

    const [action, review, trainingId] = interaction.customId.split("_"); // Extract action and trainingId from customId
    switch (action) {
      case "accept":
        await handleAcceptRule(client, interaction);
        break;
      case "selectbtn":
        await handleSelectBtn(client, interaction, review);
        break;
      case "genderbtn":
        await handleApproveRejectUser(client, interaction, review, trainingId);
        break;
      case "channelbtn":
        await handleApproveRejectChannelCreation(
          client,
          interaction,
          review,
          trainingId,
        );
        break;
      case "campaignModal":
        await handleManageCampagin(client, interaction, review, trainingId);
        break;
      case "rsvp":
        await handleRSVPButon(client, interaction, review, trainingId);
        break;
      case "readconfirm":
        await handleReadConfirm(client, interaction, review);
        break;
      case "verifyUnverifiedUser":
        await handleVerifyUnverifiedUser(client, interaction, review);
        break;
      case "readIntroContinue":
        await handleReadIntroContinue(client, interaction);
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.log(error);
  }
};

async function handleAcceptRule(client, interaction) {
  try {
    const member = interaction.member;
    const userId = interaction.user.id;
    const userData = await UserInvite.findOne({ discordId: userId });

    if (!userData) return;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🧩 Choose Your Group")
          .setDescription(
            `Welcome! Please select your group by clicking one of the buttons below:\n\n` +
              `**🤝 Brotherhood** — For male community members\n` +
              `**🌸 Sisterhood** — For female community members\n\n` +
              `This helps us personalize your experience in the server.`,
          )
          .setColor("Blurple"),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("selectbtn_brotherhood")
            .setLabel("🤝 Brotherhood")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("selectbtn_sisterhood")
            .setLabel("🌸 Sisterhood")
            .setStyle(ButtonStyle.Primary),
        ),
      ],
      ephemeral: true,
    });
  } catch (e) {
    console.log(e);
  }
}

async function handleSelectBtn(client, interaction, id) {
  const userId = interaction.user.id;
  const userData = await UserInvite.findOne({ discordId: userId });

  if (!userData) {
    return interaction.reply({
      content: "❌ User data not found in the database.",
      ephemeral: true,
    });
  }

  if (userData.onboarding.selectedGroup) {
    return interaction.reply({
      content: "❌ You've already selected a group.",
      ephemeral: true,
    });
  }

  const group = id === "brotherhood" ? "Brotherhood" : "Sisterhood";

  await UserInvite.updateOne(
    { discordId: userId },
    { "onboarding.selectedGroup": group },
  );

  const pendingChannel = await client.channels
    .fetch(process.env.PENDING_REVIEW_CHANNEL_ID)
    .catch(() => null);

  if (!pendingChannel) {
    return interaction.reply({
      content: "⚠️ Could not find the pending approval channel.",
      ephemeral: true,
    });
  }

  // Improved Clean Embed
  const embed = new EmbedBuilder()
    .setTitle("📝 New Group Approval Request")
    .setColor(0xffa500) // Orange
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp()
    .addFields(
      {
        name: "👤 Discord User",
        value: `<@${userId}> (${interaction.user.tag})`,
        inline: false,
      },
      {
        name: "📧 Email",
        value: `\`${userData.email || "Not provided"}\``,
        inline: false,
      },
      {
        name: "🔗 Invite URL",
        value: userData.inviteUrl ? `\`${userData.inviteUrl}\`` : "`Unknown`",
        inline: false,
      },
      {
        name: "🏷️ Selected Group",
        value: `**${group}**`,
        inline: false,
      },
      {
        name: "📆 Account Joined Server",
        value: `<t:${Math.floor(interaction.member.joinedTimestamp / 1000)}:F>`,
        inline: false,
      },
    );

  await pendingChannel.send({
    content: `<@${userId}> is pending approval:`,
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`genderbtn_approve_${userId}`)
          .setLabel("✅ Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`genderbtn_deny_${userId}`)
          .setLabel("❌ Deny")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });

  await interaction.reply({
    content:
      "✅ You've been added to the approval queue. A moderator will review your request soon.",
    ephemeral: true,
  });
}

async function handleApproveRejectUser(
  client,
  interaction,
  decision,
  targetId,
) {
  const moderatorRoleIds = process.env.MODERATOR_ROLE_ID
    ? process.env.MODERATOR_ROLE_ID.split(",").map((id) => id.trim())
    : [];

  const hasModeratorRole = moderatorRoleIds.some((roleId) =>
    interaction.member.roles.cache.has(roleId),
  );

  if (!hasModeratorRole) {
    return interaction.reply({
      content: "You are not authorized.",
      ephemeral: true,
    });
  }

  const targetMember = await interaction.guild.members
    .fetch(targetId)
    .catch(() => null);
  const data = await UserInvite.findOne({ discordId: targetId });

  if (!data) {
    return interaction.reply({
      content: "User not found in DB.",
      ephemeral: true,
    });
  }

  const moderatorTag = interaction.user.tag;
  const moderatorId = interaction.user.id;
  const status = decision === "approve" ? "✅ **Approved**" : "❌ **Denied**";
  const color = decision === "approve" ? 0x00ff00 : 0xff0000;

  // Update the original message (remove buttons + show who took action)
  const originalMessage = interaction.message;

  const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
    .setColor(color)
    .setTitle(
      decision === "approve"
        ? "✅ Group Request Approved"
        : "❌ Group Request Denied",
    )
    .addFields({
      name: "🔨 Action Taken By",
      value: `<@${moderatorId}> (${moderatorTag})`,
      inline: false,
    })
    .setTimestamp();

  await interaction.update({
    content: `**Status:** ${status}\n**Moderator:** <@${moderatorId}>`,
    embeds: [updatedEmbed],
    components: [], // Removes all buttons
  });

  // === Approve Logic ===
  if (decision === "approve") {
    const roleId =
      data.onboarding.selectedGroup === "Brotherhood"
        ? process.env.ROLE_BROTHERHOOD_ID
        : process.env.ROLE_SISTERHOOD_ID;

    if (targetMember) {
      await targetMember.roles
        .add([roleId, process.env.VERIFIED_ROLE_ID])
        .catch(console.error);
    }

    await UserInvite.updateOne(
      { discordId: targetId },
      { "onboarding.isApproved": true },
    );

    // GHL Tagging
    try {
      const contactsRes = await axios.get(
        "https://rest.gohighlevel.com/v1/contacts",
        {
          headers: {
            Authorization: `Bearer ${process.env.GHL_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      const contact = contactsRes.data.contacts.find(
        (c) => c.email?.toLowerCase() === data.email?.toLowerCase(),
      );

      if (contact) {
        await axios.put(
          `https://rest.gohighlevel.com/v1/contacts/${contact.id}`,
          { tags: ["Discord Member"] },
          {
            headers: {
              Authorization: `Bearer ${process.env.GHL_API_KEY}`,
              "Content-Type": "application/json",
            },
          },
        );
      }
    } catch (err) {
      console.error("❌ GHL Tagging failed:", err.message);
    }

    if (targetMember) {
      await targetMember
        .send("You have been approved and got the Server Access!")
        .catch(() => {});
    }
  }

  // === Deny Logic ===
  if (decision === "deny") {
    if (targetMember) {
      await targetMember
        .send(
          "Sorry, your access request was denied. If this is an error, please contact support.",
        )
        .catch(() => {});
    }
  }
}

async function handleApproveRejectChannelCreation(
  client,
  interaction,
  action,
  requestId,
) {
  if (!interaction.member.roles.cache.has(process.env.OWNER_ROLE_ID)) {
    return interaction.reply({
      content: "❌ Only owners can approve/deny channel requests.",
      ephemeral: true,
    });
  }

  const request = await ChannelRequest.findById(requestId);
  if (!request) {
    return interaction.reply({
      content: "⚠️ Request not found or already handled.",
      ephemeral: true,
    });
  }

  if (request.approved !== null) {
    return interaction.reply({
      content: `⚠️ This request was already ${
        request.approved ? "approved" : "denied"
      }.`,
      ephemeral: true,
    });
  }

  if (action === "approve") {
    const channelType =
      request.type === "text" ? ChannelType.GuildText : ChannelType.GuildVoice;

    const permissionOverwrites = [];

    if (request.visibility === "private") {
      permissionOverwrites.push(
        {
          id: interaction.guild.id,
          deny: ["ViewChannel"],
        },
        {
          id: request.requestedBy,
          allow: ["ViewChannel", "SendMessages"],
        },
        {
          id: process.env.OWNER_ROLE_ID,
          allow: ["ViewChannel", "SendMessages"],
        },
      );
    }

    const newChannel = await interaction.guild.channels.create({
      name: request.name,
      type: channelType,
      parent: request.categoryId,
      permissionOverwrites,
    });

    await ChannelRequest.findByIdAndUpdate(requestId, { approved: true });

    return interaction.reply({
      content: `✅ Channel <#${newChannel.id}> created successfully.`,
      ephemeral: true,
    });
  }

  if (action === "deny") {
    await ChannelRequest.findByIdAndUpdate(requestId, { approved: false });

    return interaction.reply({
      content: "❌ Channel request denied.",
      ephemeral: true,
    });
  }
}

async function handleManageCampagin(client, interaction, id, name) {
  if (!interaction.member.roles.cache.has(process.env.OWNER_ROLE_ID)) {
    return interaction.reply({
      content: "❌ Only owners can approve/deny channel requests.",
      ephemeral: true,
    });
  }

  const request = await ChannelRequest.findById(requestId);
  if (!request) {
    return interaction.reply({
      content: "⚠️ Request not found or already handled.",
      ephemeral: true,
    });
  }

  if (request.approved !== null) {
    return interaction.reply({
      content: `⚠️ This request was already ${
        request.approved ? "approved" : "denied"
      }.`,
      ephemeral: true,
    });
  }

  if (action === "approve") {
    const channelType =
      request.type === "text" ? ChannelType.GuildText : ChannelType.GuildVoice;

    const permissionOverwrites = [];

    if (request.visibility === "private") {
      permissionOverwrites.push(
        {
          id: interaction.guild.id,
          deny: ["ViewChannel"],
        },
        {
          id: request.requestedBy,
          allow: ["ViewChannel", "SendMessages"],
        },
        {
          id: process.env.OWNER_ROLE_ID,
          allow: ["ViewChannel", "SendMessages"],
        },
      );
    }

    const newChannel = await interaction.guild.channels.create({
      name: request.name,
      type: channelType,
      parent: request.categoryId,
      permissionOverwrites,
    });

    await ChannelRequest.findByIdAndUpdate(requestId, { approved: true });

    return interaction.reply({
      content: `✅ Channel <#${newChannel.id}> created successfully.`,
      ephemeral: true,
    });
  }

  if (action === "deny") {
    await ChannelRequest.findByIdAndUpdate(requestId, { approved: false });

    return interaction.reply({
      content: "❌ Channel request denied.",
      ephemeral: true,
    });
  }
}
async function handleRSVPButon(client, interaction, answer, name) {
  const response =
    answer === "yes" ? "🎉 You’re attending!" : "😢 Got it, you can't make it.";
  await interaction.reply({ content: response, ephemeral: true });
}

async function handleReadConfirm(client, interaction, userId) {
  const user = interaction.user;

  if (user.id !== userId) {
    await interaction.reply({
      content: "❌ This button isn’t for you!",
      ephemeral: true,
    });
    return;
  }

  const userData = await UserInvite.findOne({ discordId: userId });
  console.log(userData);

  if (userData?.onboarding?.hasReacted) {
    await interaction.reply({
      content: "✅ You've already confirmed this step!",
      ephemeral: true,
    });
    return;
  }

  await UserInvite.findOneAndUpdate(
    { discordId: user.id },
    { "onboarding.hasReacted": true },
  );

  const rulesChannel = await client.channels.fetch(
    process.env.RULES_CHANNEL_ID,
  );

  await rulesChannel.permissionOverwrites.edit(user.id, {
    ViewChannel: true,
    SendMessages: false,
    ReadMessageHistory: true,
  });

  await interaction.reply({
    content: `✅ Successfully linked your account, read thre rules and click on "I Accept" in rules channel.`,
    ephemeral: true,
  });
}

async function handleReadIntroContinue(client, interaction) {
  const userId = interaction.user.id;

  try {
    const guild = interaction.guild;
    const member = await guild.members.fetch(userId).catch(() => null);

    if (!member) {
      return interaction.reply({
        content: "❌ Could not find this member.",
        ephemeral: true,
      });
    }

    // Fetch the invite record

    const doc = await User.findOne({ discordId: userId });

    if (!doc) {
      return interaction.reply({
        content: "❌ No invite record found for you.",
        ephemeral: true,
      });
    }

    // --- BAD USER FLOW ---
    if (doc.blacklist) {
      const specialEmbed = new EmbedBuilder()
        .setTitle("⚠️ Welcome! But your invite looks unusual...")
        .setDescription(
          `Hey <@${member.user.id}> 👋\nIt seems the invite you used wasn’t assigned to you. Please click the button below to continue verification.`,
        )
        .setColor("Red")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

      const specialRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`verifyUnverifiedUser_${member.user.id}`)
          .setLabel("🔑 Start Verification")
          .setStyle(ButtonStyle.Danger),
      );

      // Send ephemeral message to the user
      await interaction.reply({
        embeds: [specialEmbed],
        components: [specialRow],
        ephemeral: true,
      });

      return;
    }

    // --- GOOD USER FLOW ---
    const user = interaction.user;

    // 1️⃣ Check if already reacted
    if (doc.onboarding?.hasReacted) {
      await interaction.reply({
        content: "✅ You've already confirmed this step!",
        ephemeral: true,
      });
      return;
    }

    // 2️⃣ Mark as reacted in DB
    await UserInvite.findOneAndUpdate(
      { discordId: user.id },
      { "onboarding.hasReacted": true },
    );

    // 3️⃣ Grant read-only access to rules channel
    const rulesChannel = await client.channels.fetch(
      process.env.RULES_CHANNEL_ID,
    );

    await rulesChannel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: false,
      ReadMessageHistory: true,
    });

    // 4️⃣ Ghost ping the user
    const ghostMessage = await rulesChannel.send({
      content: `<@${user.id}>`,
    });

    setTimeout(() => {
      ghostMessage.delete().catch(() => null);
    }, 1000);

    // 5️⃣ Ephemeral confirmation
    await interaction.reply({
      content: `✅ Successfully linked your account! Read the rules in ${rulesChannel} and click "I Accept" to continue.`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("❌ Error in handleReadIntroContinue:", err);
    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Something went wrong.",
        ephemeral: true,
      });
    }
  }
}

async function handleVerifyUnverifiedUser(client, interaction) {
  try {
    const guild = interaction.guild;
    const member = await guild.members
      .fetch(interaction.user.id)
      .catch(() => null);

    if (!member) {
      return interaction.reply({
        content: "❌ Could not find this member.",
        ephemeral: true,
      });
    }

    // 1️⃣ DM user with explanation and form link
    try {
      const formUrl = process.env.WRONG_INVITE_FORM_URL;

      await member.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚠️ Wrong Invite Link Detected")
            .setDescription(
              `Hey <@${member.id}> 👋
It seems you joined using an invite not assigned to you.

Please fill out this form to request a valid invite:

[📋 Fill the Form Here](${formUrl})

After filling, you’ll receive the correct invite link for this server.`,
            )
            .setColor("Red"),
        ],
      });

      await member.send(
        "⛔ You will now be removed from the server until you get the correct invite link.",
      );
    } catch (err) {
      console.log(`⚠️ Could not DM ${member.user.tag}:`, err.message);
    }

    // 2️⃣ Kick the user
    await member.kick("Joined with wrong invite link");

    // 3️⃣ Reply to the button interaction
    await interaction.reply({
      content: `✅ <@${member.id}> has been notified, sent the form link, and kicked.`,
      ephemeral: true,
    });

    console.log(`👢 Kicked ${member.user.tag} for using wrong invite.`);
  } catch (error) {
    console.error("❌ Error in handleVerifyUnverifiedUser:", error);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Something went wrong while handling verification.",
        ephemeral: true,
      });
    }
  }
}
