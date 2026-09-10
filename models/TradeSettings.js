const mongoose = require("mongoose");

const tradeSettingsSchema =
  new mongoose.Schema(
    {
      status: {
        type: String,
        enum: [
          "Closed",
          "Open",
          "Ended"
        ],
        default: "Closed"
      },

      durationMinutes: {
        type: Number,
        default: 10,
        min: 1
      },

      openedAt: {
        type: Date,
        default: null
      },

      endsAt: {
        type: Date,
        default: null
      },

      closedAt: {
        type: Date,
        default: null
      }
    },
    {
      timestamps: true
    }
  );

module.exports =
  mongoose.models.TradeSettings ||
  mongoose.model(
    "TradeSettings",
    tradeSettingsSchema
  );