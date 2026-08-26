const express = require("express");
const bcrypt = require("bcryptjs");

const Team =
  require("../models/Team.js");

const Club =
  require("../models/Club.js");

const router =
  express.Router();

/* =========================================================
   GET ALL TEAM ACCOUNTS
========================================================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const teams =
        await Team.find()
          .select(
            "club username adminPassword purse players isActive createdAt updatedAt"
          )
          .populate(
            "club",
            "name country logo"
          )
          .populate({
            path: "players",
            select:
              "name age nationality position category rating basePrice image status soldPrice"
          })
          .sort({
            createdAt: -1
          });

      res.json(
        teams
      );
    } catch (error) {
      console.error(
        "Get admin teams error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch team accounts"
      });
    }
  }
);

/* =========================================================
   GET ONE TEAM
========================================================= */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const team =
        await Team.findById(
          req.params.id
        )
          .select(
            "club username adminPassword purse players isActive createdAt updatedAt"
          )
          .populate(
            "club",
            "name country logo"
          )
          .populate({
            path: "players",
            select:
              "name age nationality position category rating basePrice image status soldPrice"
          });

      if (!team) {
        return res.status(404).json({
          message:
            "Team account not found"
        });
      }

      res.json(
        team
      );
    } catch (error) {
      console.error(
        "Get admin team error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch team account"
      });
    }
  }
);

/* =========================================================
   UPDATE TEAM
========================================================= */

router.put(
  "/:id",
  async (req, res) => {
    try {
      const {
        username,
        password,
        isActive
      } = req.body;

      const team =
        await Team.findById(
          req.params.id
        );

      if (!team) {
        return res.status(404).json({
          message:
            "Team account not found"
        });
      }

      if (username) {
        const cleanUsername =
          username.trim();

        const duplicate =
          await Team.findOne({
            username:
              cleanUsername,

            _id: {
              $ne: team._id
            }
          });

        if (duplicate) {
          return res.status(409).json({
            message:
              "Username already exists"
          });
        }

        team.username =
          cleanUsername;
      }

      if (
        password !== undefined &&
        String(password).trim() !== ""
      ) {
        const cleanPassword =
          String(password);

        team.password =
          await bcrypt.hash(
            cleanPassword,
            10
          );

        team.adminPassword =
          cleanPassword;
      }

      if (
        typeof isActive ===
        "boolean"
      ) {
        team.isActive =
          isActive;
      }

      await team.save();

      const updatedTeam =
        await Team.findById(
          team._id
        )
          .select(
            "club username adminPassword purse players isActive createdAt updatedAt"
          )
          .populate(
            "club",
            "name country logo"
          )
          .populate({
            path: "players",
            select:
              "name age nationality position category rating basePrice image status soldPrice"
          });

      res.json({
        message:
          "Team account updated successfully",

        team:
          updatedTeam
      });
    } catch (error) {
      console.error(
        "Update team error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update team account"
      });
    }
  }
);

/* =========================================================
   DELETE TEAM
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const team =
        await Team.findById(
          req.params.id
        );

      if (!team) {
        return res.status(404).json({
          message:
            "Team account not found"
        });
      }

      if (
        team.players &&
        team.players.length > 0
      ) {
        return res.status(400).json({
          message:
            "Cannot delete a team account that already has purchased players. Use Reset Auction first."
        });
      }

      const clubId =
        team.club;

      await Team.findByIdAndDelete(
        req.params.id
      );

      if (clubId) {
        await Club.findByIdAndUpdate(
          clubId,
          {
            $set: {
              assignedTo:
                null,

              isAvailable:
                true
            }
          }
        );
      }

      res.json({
        message:
          "Team account deleted successfully"
      });
    } catch (error) {
      console.error(
        "Delete team error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete team account"
      });
    }
  }
);

module.exports =
  router;