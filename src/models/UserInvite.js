const mongoose = require("mongoose");

// Existing UserInvite schema (keep as is)
const userInviteSchema = new mongoose.Schema({
  email: { type: String, required: false, unique: true },
  inviteUrl: { type: String, required: false },
  discordId: { type: String, default: null },
  username: { type: String, default: null },
  joinedAt: { type: Date, default: null },
  blacklist: { type: Boolean, default: false },
  onboarding: {
    hasReacted: { type: Boolean, default: false },
    acceptedRules: { type: Boolean, default: false },
    selectedGroup: {
      type: String,
      enum: ["Brotherhood", "Sisterhood", null],
      default: null,
    },
    isApproved: { type: Boolean, default: false },
  },
  engagement: {
    prayerWindows: {
      type: Map,
      of: {
        expiresAt: { type: Date, default: null },
        count: { type: Number, default: 0 },
      },
      default: new Map(),
    },
    totalPrayerCount: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserInvite", userInviteSchema);
