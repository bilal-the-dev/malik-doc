require("dotenv").config();
const {
  Client,
  IntentsBitField,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const eventHandler = require("./handlers/eventHandler");
const UserInvite = require("./models/UserInvite");
const { isPrayerChannel, handleEngagement } = require("./utils/prayerSystem");
const Invite = require("./models/Invite");
const User = require("./models/User");
const app = express();
const PORT = process.env.PORT || 3000;

// Discord client setup
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildInvites,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// === API to receive form and generate invite ===
app.post("/api/form-submit", async (req, res) => {
  try {
    const { firstName, lastName, phone, email, joining, interests } = req.body;
    const existingUser = await UserInvite.findOne({
      email: email.toLowerCase(),
    });
    if (existingUser) {
      return res.status(409).json({
        error: true,
        message: "This email has already been registered.",
      });
    }

    const guildId = process.env.GUILD_ID;
    const channelId = process.env.INVITE_CHANNEL_ID;

    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);

    if (!channel || !channel.createInvite) {
      return res.status(500).json({ error: "Unable to create invite." });
    }

    const invite = await channel.createInvite({
      maxAge: 0, // Never expires
      maxUses: 0, // ♾ Unlimited uses
      unique: true,
      reason: `Invite for ${firstName} ${lastName}`,
    });

    const inviteUrl = `https://discord.gg/${invite.code}`;

    // Save to GoHighLevel
    const ghlApiKey = process.env.GHL_API_KEY;
    const locationId = "fUri88hWP5UXvHZciGhn"; // Your sub-account ID

    await axios.post(
      "https://rest.gohighlevel.com/v1/contacts",
      {
        firstName,
        lastName,
        email,
        phone,
        locationId,
        customField: {
          invite_url: inviteUrl,
          joining_reason: joining,
          interests: Array.isArray(interests)
            ? interests.join(", ")
            : interests,
        },
        tags: ["Discord Signup"],
      },
      {
        headers: {
          Authorization: `Bearer ${ghlApiKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    await UserInvite.create({
      email,
      inviteUrl,
    });
    return res.status(200).json({
      message: "Invite generated and contact saved to GHL!",
      data: {
        firstName,
        lastName,
        phone,
        email,
        joining,
        interests,
        inviteUrl,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong." });
  }
});

app.post("/api/get-data", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required." });

    const contactResponse = await axios.get(
      "https://rest.gohighlevel.com/v1/contacts",
      {
        headers: {
          Authorization: `Bearer ${process.env.GHL_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const contactList = contactResponse.data.contacts || [];
    const contact = contactList.find(
      (c) => c.email?.toLowerCase() === email.toLowerCase(),
    );

    if (!contact) return res.status(404).json({ error: "Contact not found." });

    // Map field IDs to names
    const customFieldMap = {
      dX2ve7XvOVW9Uzp4aQg7: "invite_url",
      CkaCS8QTt10tIDLrWs2G: "joining_reason",
      HGN1mRGF7jr2g2jf31lc: "interests",
    };
    console.log(contact.customField);
    const fields = {};
    for (const field of contact.customField || []) {
      const key = customFieldMap[field.id] || field.id;
      fields[key] = field.value;
    }

    if (!fields.invite_url)
      return res.status(404).json({ error: "Invite URL not found." });

    return res.status(200).json({
      message: "Invite URL fetched successfully!",
      data: {
        email,
        inviteUrl: fields.invite_url,
        joiningReason: fields.joining_reason,
        interests: fields.interests,
      },
    });
  } catch (error) {
    console.error("❌ Error in /api/get-data:", error.message);
    return res.status(500).json({ error: "Something went wrong." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start Express server
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});

eventHandler(client);

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();

      for (const invite of invites.values()) {
        await Invite.findOneAndUpdate(
          { guildId: guild.id, code: invite.code },
          {
            guildId: guild.id,
            code: invite.code,
            uses: invite.uses,
            inviterId: invite.inviter?.id || null,
          },
          { upsert: true },
        );
      }
    } catch (err) {
      console.error(`Couldn't fetch invites for guild ${guild.id}`, err);
    }
  }
});

// When a new invite is created
client.on("inviteCreate", async (invite) => {
  await Invite.findOneAndUpdate(
    { guildId: invite.guild.id, code: invite.code },
    {
      guildId: invite.guild.id,
      code: invite.code,
      uses: invite.uses,
      inviterId: invite.inviter?.id || null,
    },
    { upsert: true },
  );
});

client.on("guildMemberAdd", async (member) => {
  console.log(`👤 ${member.user.tag} joined ${member.guild.name}`);

  try {
    const guildInvites = await member.guild.invites.fetch();

    for (const invite of guildInvites.values()) {
      const dbInvite = await Invite.findOne({
        guildId: member.guild.id,
        code: invite.code,
      });

      if (dbInvite && invite.uses > dbInvite.uses) {
        console.log(`✅ User joined with invite code: ${invite.code}`);

        // Update invite usage
        dbInvite.uses = invite.uses;
        await dbInvite.save();

        const inviteUrl = `https://discord.gg/${invite.code}`;
        const doc = await UserInvite.findOne({ inviteUrl });

        if (doc) {
          // CASE 1: Same user joined again
          if (doc.discordId && doc.discordId === member.user.id) {
            console.log(`ℹ️ ${member.user.tag} already linked to this invite.`);

            // Ensure blacklist = false
            await User.findOneAndUpdate(
              { discordId: member.user.id },
              {
                discordId: member.user.id,
                username: member.user.tag,
                blacklist: false,
              },
              { upsert: true },
            );
          }

          // CASE 2: Invite not linked yet
          else if (!doc.discordId) {
            doc.discordId = member.user.id;
            doc.username = member.user.tag;
            doc.joinedAt = new Date();
            await doc.save();

            console.log(`📌 Linked new user ${member.user.tag} to invite.`);

            // Valid invite → not blacklisted
            await User.findOneAndUpdate(
              { discordId: member.user.id },
              {
                discordId: member.user.id,
                username: member.user.tag,
                blacklist: false,
              },
              { upsert: true },
            );

            if (doc.email) {
              await updateGHLContact(
                doc.email,
                member.user.id,
                member.user.tag,
              );
            }
          }

          // CASE 3: Wrong user used invite
          else if (doc.discordId !== member.user.id) {
            console.log(
              `⚠️ Invite was meant for ${doc.username}, but used by ${member.user.tag}`,
            );

            // Mark this user as blacklisted
            await User.findOneAndUpdate(
              { discordId: member.user.id },
              {
                discordId: member.user.id,
                username: member.user.tag,
                blacklist: true,
              },
              { upsert: true },
            );
          }
        } else {
          console.log(`⚠️ No UserInvite found for URL ${inviteUrl}`);
        }

        break;
      }
    }
  } catch (err) {
    console.error("Error handling guildMemberAdd:", err);
  }
});

client.on("guildMemberRemove", async (member) => {
  console.log(`❌ ${member.user.tag} left ${member.guild.name}`);

  try {
    await UserInvite.findOneAndUpdate(
      { discordId: member.user.id },
      {
        $set: {
          "onboarding.selectedGroup": null,
          "onboarding.isApproved": false,
          // optional resets
          "onboarding.hasReacted": false,
          "onboarding.acceptedRules": false,
        },
      },
    );

    console.log(`🔄 Onboarding reset for ${member.user.tag}`);
  } catch (err) {
    console.error("Error handling guildMemberRemove:", err);
  }
});
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  const channel = reaction.message.channel;
  if (!isPrayerChannel(channel.id)) return;

  const member = await channel.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  // Handle engagement for the specific channel the user reacted in
  await handleEngagement(member, channel);
});
client.login(process.env.TOKEN);

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
        },
      );

      const contacts = contactsResponse.data.contacts || [];
      allContacts = allContacts.concat(contacts);

      hasMore = contacts.length === 100; // If we got 100, there might be more
      page++;
    }

    const contact = allContacts.find(
      (c) => c.email?.toLowerCase() === email.toLowerCase(),
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
      },
    );

    console.log(`✅ Discord ID ${discordId} updated in GHL for ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ GHL update failed:`, error.message);
  }
}
