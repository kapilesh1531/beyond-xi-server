const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    /* =====================================================
       PLAYER NAME
    ===================================================== */

    name: {
      type: String,
      required: true,
      trim: true
    },

    /* =====================================================
       AGE

       OPTIONAL FOR BULK IMPORT
    ===================================================== */

    age: {
      type: Number,
      required: false,
      default: null,

      min: 0,
      max: 100
    },

    /* =====================================================
       NATIONALITY
    ===================================================== */

    nationality: {
      type: String,
      required: true,
      trim: true
    },

    /* =====================================================
       POSITION
    ===================================================== */

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

    /* =====================================================
       CATEGORY
    ===================================================== */

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

    /* =====================================================
       RATING
    ===================================================== */

    rating: {
      type: Number,
      required: true,

      min: 1,
      max: 100
    },

    /* =====================================================
       BASE PRICE
    ===================================================== */

    basePrice: {
      type: Number,
      required: true,

      min: 0
    },

    /* =====================================================
       PLAYER IMAGE
    ===================================================== */

    image: {
      type: String,
      default: ""
    },

    /* =====================================================
       AUCTION STATUS
    ===================================================== */

    status: {
      type: String,

      enum: [
        "Pool",
        "Available",
        "Sold",
        "Unsold"
      ],

      default: "Available"
    },

    /* =====================================================
       AUCTION CONTROL
    ===================================================== */

    activeForAuction: {
      type: Boolean,
      default: true
    },

    auctionOrder: {
      type: Number,
      default: null
    },

    /* =====================================================
       SOLD INFORMATION
    ===================================================== */

    soldTo: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "Team",

      default: null
    },

    soldPrice: {
      type: Number,

      default: null,

      min: 0
    }
  },

  {
    timestamps: true
  }
);

/* =========================================================
   PREVENT MODEL OVERWRITE / DUPLICATE MODEL ERROR
========================================================= */

module.exports =
  mongoose.models.Player ||
  mongoose.model(
    "Player",
    playerSchema
  );