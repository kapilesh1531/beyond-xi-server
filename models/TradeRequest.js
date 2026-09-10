const mongoose = require("mongoose");

const tradeRequestSchema =
  new mongoose.Schema(
    {
      fromTeam: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Team",
        required: true
      },

      toTeam: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Team",
        required: true
      },

      offeredPlayer: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Player",
        required: true
      },

      requestedPlayer: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Player",
        required: true
      },

      status: {
        type: String,
        enum: [
          "Pending",
          "Accepted",
          "Rejected",
          "Cancelled"
        ],
        default: "Pending"
      },

      respondedAt: {
        type: Date,
        default: null
      }
    },
    {
      timestamps: true
    }
  );

module.exports =
  mongoose.models.TradeRequest ||
  mongoose.model(
    "TradeRequest",
    tradeRequestSchema
  );