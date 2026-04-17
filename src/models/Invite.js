const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema({
  guildId: String,
  code: String,
  uses: Number,
  inviterId: String,
});

module.exports = mongoose.model("Invite", inviteSchema);
