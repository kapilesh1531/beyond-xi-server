const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    age: {
      type: Number,
      required: true
    },

    nationality: {
      type: String,
      required: true,
      trim: true
    },

    position: {
      type: String,
      required: true,
      enum: [
        "Goalkeeper",
        "Defender",
        "Midfielder",
        "Forward"
      ]
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Elite",
        "World Class",
        "High Quality",
        "Rising/Value"
      ]
    },

    rating: {
      type: Number,
      required: true
    },

    basePrice: {
      type: Number,
      required: true
    },

    image: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: [
        "Pool",
        "Available",
        "Sold",
        "Unsold"
      ],
      default: "Pool"
    },

    activeForAuction: {
      type: Boolean,
      default: false
    },

    auctionOrder: {
      type: Number,
      default: null
    },

    soldTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null
    },

    soldPrice: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.model(
    "Player",
    playerSchema
  );