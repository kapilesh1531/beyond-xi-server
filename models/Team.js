const mongoose = require("mongoose");

const bestXISchema = new mongoose.Schema(
  {
    submitted: {
      type: Boolean,
      default: false
    },

    formation: {
      goalkeeper: {
        type: Number,
        default: 1
      },

      defender: {
        type: Number,
        default: 4
      },

      midfield: {
        type: Number,
        default: 3
      },

      attack: {
        type: Number,
        default: 3
      }
    },

    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player"
      }
    ],

    submittedAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);

const teamSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
      unique: true
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    /*
      Stored separately so the admin can
      display/recover the team password
      according to your current system design.
    */
    adminPassword: {
      type: String,
      default: ""
    },

    purse: {
      type: Number,
      default: 200000000
    },

    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player"
      }
    ],

    bestXI: {
      type: bestXISchema,

      default: () => ({
        submitted: false,

        formation: {
          goalkeeper: 1,
          defender: 4,
          midfield: 3,
          attack: 3
        },

        players: [],

        submittedAt: null
      })
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.Team ||
  mongoose.model(
    "Team",
    teamSchema
  );