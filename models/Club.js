const mongoose = require("mongoose");

const clubSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        unique: true,
        trim: true
      },

      country: {
        type: String,
        default: "",
        trim: true
      },

      logo: {
        type: String,
        default: ""
      },

      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        default: null
      },

      isAvailable: {
        type: Boolean,
        default: true
      }
    },
    {
      timestamps: true
    }
  );

module.exports =
  mongoose.model(
    "Club",
    clubSchema
  );