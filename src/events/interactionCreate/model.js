const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const UserInvite = require("../../models/UserInvite");
const axios = require("axios");
const ChannelRequest = require("../../models/ChannelRequest");
const EventCampaign = require("../../models/EventCampaign");

module.exports = async (client, interaction) => {
  try {
    if (!interaction.isModalSubmit()) return;

    const [action, id, name] = interaction.customId.split("_");
    switch (action) {
      case "campaignModal":
        await handleManageCampagin(client, interaction, id, name);
        break;
      case "submitEmail":
        await handleSubmitEmailUser(client, interaction, id);
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.log(error);
  }
};

async function handleManageCampagin(client, interaction, channelId, name) {
  const parseMessage = (raw) => {
    const [datetime, ...rest] = raw.split("|");
    if (!datetime || !rest.length) return null;

    const [datePart, timePart] = datetime.trim().split(" ");
    if (!datePart || !timePart) return null;

    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    if (!year || !month || !day || hour === undefined || minute === undefined) {
      return null;
    }

    // User enters UTC time, we save UTC time
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const content = rest.join("|").trim();

    return { sendAt: utcDate, content };
  };

  const messages = [];
  const now = new Date();

  for (let i = 1; i <= 5; i++) {
    const raw = interaction.fields.getTextInputValue(`message${i}`)?.trim();
    if (!raw) continue;

    const parsed = parseMessage(raw);
    if (parsed && parsed.content.length > 0) {
      if (parsed.sendAt <= now) {
        return interaction.reply({
          content: `⚠️ Message ${i}: The scheduled time must be in the future!\nEnter UTC time in format: YYYY-MM-DD HH:mm | message`,
          ephemeral: true,
        });
      }
      messages.push({ ...parsed, sent: false });
    }
  }

  if (messages.length === 0) {
    return interaction.reply({
      content:
        "⚠️ You must include at least 1 valid message in UTC format:\n`YYYY-MM-DD HH:mm | your message`",
      ephemeral: true,
    });
  }

  messages.sort((a, b) => a.sendAt - b.sendAt);

  await EventCampaign.create({
    name,
    channelId,
    createdBy: interaction.user.id,
    messages,
  });

  await interaction.reply({
    content: `✅ Campaign **${name}** scheduled with ${messages.length} message(s) in UTC.`,
    ephemeral: true,
  });
}

async function handleSubmitEmailUser(client, interaction, userId) {
  const user = interaction.user;
  const rawEmail = interaction.fields.getTextInputValue("email_input");
  const email = rawEmail.trim().toLowerCase();

  try {
    const existingEmailLink = await UserInvite.findOne({
      email,
      discordId: { $ne: null },
    });

    if (existingEmailLink) {
      return await interaction.reply({
        content: `❌ This email has already been linked to another Discord account.`,
        ephemeral: true,
      });
    }

    const existingUserLink = await UserInvite.findOne({
      discordId: interaction.user.id,
      email: { $ne: email },
    });

    if (existingUserLink) {
      return await interaction.reply({
        content: `❌ You have already linked your Discord to a different email: **${existingUserLink.email}**.`,
        ephemeral: true,
      });
    }

    // 3. Find and update the user's invite entry
    const userInvite = await UserInvite.findOneAndUpdate(
      { email },
      {
        discordId: interaction.user.id,
        username: interaction.user.tag,
        joinedAt: new Date(),
      },
      { new: true }
    );

    // 4. If no entry was found at all
    if (!userInvite) {
      return await interaction.reply({
        content:
          "❌ Email not found. Please make sure you used the correct one.",
        ephemeral: true,
      });
    }

    await updateGHLContact(email, interaction.user.id, interaction.user.tag);

    const member = interaction.guild.members.cache.get(user.id);
    const userData = await UserInvite.findOne({ discordId: user.id });
    console.log(userData);

    if (userData?.onboarding?.hasReacted) {
      await interaction.reply({
        content: "✅ You've already confirmed this step!",
        ephemeral: true,
      });
      return;
    }
  } catch (error) {
    console.error("❌ Failed to link email:", error);
    await interaction.reply({
      content: "❌ Something went wrong. Please try again.",
      ephemeral: true,
    });
  }
}

async function updateGHLContact(email, discordId, username) {
  try {
    console.log(`📧 Searching for contact with email: ${email}`);

    // Fetch all contacts from GHL with pagination
    let allContacts = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const contactsResponse = await axios.get(
        `https://rest.gohighlevel.com/v1/contacts?page=${page}&limit=100`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GHL_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 10000, // 10 second timeout
        }
      );

      const contacts = contactsResponse.data.contacts || [];
      allContacts = allContacts.concat(contacts);

      hasMore = contacts.length === 100; // If we got 100, there might be more
      page++;
    }

    const contact = allContacts.find(
      (c) => c.email?.toLowerCase() === email.toLowerCase()
    );

    if (!contact) {
      console.log(`⚠️ GHL contact not found for email: ${email}`);
      return false;
    }

    const contactId = contact.id;

    // Update the Discord ID in GHL
    await axios.put(
      `https://rest.gohighlevel.com/v1/contacts/${contactId}`,
      {
        customField: {
          [process.env.DISCORD_ID_FIELD_ID]: discordId,
        },
        customFields: {
          discord_username: username,
          discord_joined_at: new Date().toISOString(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GHL_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log(`✅ Discord ID ${discordId} updated in GHL for ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ GHL update failed:`, error.message);
  }
}
