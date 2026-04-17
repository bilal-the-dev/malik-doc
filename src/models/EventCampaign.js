const mongoose = require("mongoose");

const eventCampaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  channelId: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  messages: [
    {
      content: {
        type: String,
        required: true,
      },
      sendAt: {
        type: Date,
        required: true,
        index: true, // Index for faster queries
      },
      sent: {
        type: Boolean,
        default: false,
        index: true, // Index for faster queries
      },
      sentAt: {
        type: Date,
        default: null,
      },
    },
  ],
  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

// Compound index for efficient queries
eventCampaignSchema.index({
  "messages.sent": 1,
  "messages.sendAt": 1,
});

module.exports = mongoose.model("EventCampaign", eventCampaignSchema);
