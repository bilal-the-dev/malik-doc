const mongoose = require("mongoose");

const weeklyEventSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  day: { type: String, required: true }, // e.g., Friday
  time: { type: String, required: true }, // e.g., 12:00 (24h format)
  channelId: { type: String, required: true },
  createdBy: { type: String, required: true },
  includeRSVP: { type: Boolean, default: false },
  skipNext: { type: Boolean, default: false },
  lastSentAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("WeeklyEvent", weeklyEventSchema);
