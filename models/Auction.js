const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

const auctionResultSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true
    },

    result: {
      type: String,
      enum: ["Sold", "Unsold"],
      required: true
    },

    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null
    },

    amount: {
      type: Number,
      default: 0
    },

    completedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

const auctionSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "Not Started",
        "Live",
        "Paused",
        "Completed"
      ],
      default: "Not Started"
    },

    playerPool: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player"
      }
    ],

    currentPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null
    },

    currentPlayerIndex: {
      type: Number,
      default: -1
    },

    currentBid: {
      type: Number,
      default: 0
    },

    highestBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null
    },

    bids: {
      type: [bidSchema],
      default: []
    },

    results: {
      type: [auctionResultSchema],
      default: []
    },

    startedAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Auction",
  auctionSchema
);