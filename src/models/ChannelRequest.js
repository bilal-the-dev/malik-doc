const mongoose = require("mongoose");

const channelRequestSchema = new mongoose.Schema({
  requestedBy: { type: String, required: true }, // user ID
  name: { type: String, required: true },
  type: { type: String, enum: ["text", "voice"], required: true },
  visibility: { type: String, enum: ["public", "private"], required: true },
  categoryId: { type: String, required: true },
  approved: { type: Boolean, default: null }, // true, false, or null (pending)
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChannelRequest", channelRequestSchema);
