const WeeklyEvent = require("../../models/WeeklyEvent");

module.exports = {
  name: "skipweekly",
  description: "Skip next reminder for a weekly event",
  options: [
    {
      name: "name",
      type: 3,
      description: "Name of the event",
      required: true,
    },
  ],

  callback: async (client, interaction) => {
    const name = interaction.options.getString("name");
    const event = await WeeklyEvent.findOne({ name });

    if (!event) {
      return interaction.reply({
        content: "❌ Event not found.",
        ephemeral: true,
      });
    }

    event.skipNext = true;
    await event.save();

    interaction.reply({
      content: `⏭️ Next reminder for **${name}** will be skipped.`,
      ephemeral: true,
    });
  },
};
