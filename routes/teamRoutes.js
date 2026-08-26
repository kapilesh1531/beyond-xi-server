const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Team = require("../models/Team");
const Club = require("../models/Club");

const Player =
  mongoose.models.Player;

const router =
  express.Router();

/* =========================================================
   CREATE TEAM ACCOUNT
========================================================= */

router.post(
  "/add",
  async (req, res) => {
    try {
      const {
        clubId,
        username,
        password
      } = req.body;

      if (
        !clubId ||
        !username ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Club, username and password are required"
        });
      }

      const cleanUsername =
        username.trim();

      const cleanPassword =
        String(password);

      const club =
        await Club.findOne({
          _id: clubId,
          isAvailable: true,
          assignedTo: null
        });

      if (!club) {
        return res.status(409).json({
          message:
            "This club is already assigned or unavailable"
        });
      }

      const existingUsername =
        await Team.findOne({
          username:
            cleanUsername
        });

      if (existingUsername) {
        return res.status(409).json({
          message:
            "Username already exists"
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          cleanPassword,
          10
        );

      const team =
        new Team({
          club: clubId,

          username:
            cleanUsername,

          password:
            hashedPassword,

          adminPassword:
            cleanPassword,

          purse:
            200000000,

          players: [],

          bestXI: {
            submitted: false,

            formation: {
              goalkeeper: 1,
              defender: 4,
              midfield: 3,
              attack: 3
            },

            players: [],

            submittedAt: null
          },

          isActive: true
        });

      await team.save();

      club.assignedTo =
        team._id;

      club.isAvailable =
        false;

      await club.save();

      const populatedTeam =
        await Team.findById(
          team._id
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
          .populate({
            path: "bestXI.players",
            select:
              "name age nationality position category rating image soldPrice"
          });

      res.status(201).json({
        message:
          "Team account created successfully",

        team:
          populatedTeam
      });
    } catch (error) {
      console.error(
        "Add team error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Failed to create team account"
      });
    }
  }
);

/* =========================================================
   TEAM LOGIN
========================================================= */

router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        username,
        password
      } = req.body;

      if (
        !username ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Username and password are required"
        });
      }

      const team =
        await Team.findOne({
          username:
            username.trim()
        })
          .populate(
            "club",
            "name country logo"
          )
          .populate({
            path: "players",
            select:
              "name age nationality position category rating basePrice image status soldPrice"
          })
          .populate({
            path: "bestXI.players",
            select:
              "name age nationality position category rating image soldPrice"
          });

      if (!team) {
        return res.status(401).json({
          message:
            "Invalid team username or password"
        });
      }

      if (!team.isActive) {
        return res.status(403).json({
          message:
            "This team account is inactive"
        });
      }

      const passwordMatch =
        await bcrypt.compare(
          password,
          team.password
        );

      if (!passwordMatch) {
        return res.status(401).json({
          message:
            "Invalid team username or password"
        });
      }

      res.json({
        message:
          "Team login successful",

        role:
          "team",

        teamId:
          team._id,

        username:
          team.username,

        purse:
          team.purse,

        club:
          team.club,

        players:
          team.players,

        bestXI:
          team.bestXI
      });
    } catch (error) {
      console.error(
        "Team login error:",
        error
      );

      res.status(500).json({
        message:
          "Login failed"
      });
    }
  }
);

/* =========================================================
   GET TEAM
========================================================= */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const team =
        await Team.findById(
          req.params.id
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
          .populate({
            path: "bestXI.players",
            select:
              "name age nationality position category rating image soldPrice"
          });

      if (!team) {
        return res.status(404).json({
          message:
            "Team not found"
        });
      }

      res.json(team);
    } catch (error) {
      console.error(
        "Get team error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch team"
      });
    }
  }
);

/* =========================================================
   GET BEST XI
========================================================= */

router.get(
  "/:id/best-xi",
  async (req, res) => {
    try {
      const team =
        await Team.findById(
          req.params.id
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
          .populate({
            path: "bestXI.players",
            select:
              "name age nationality position category rating image soldPrice"
          });

      if (!team) {
        return res.status(404).json({
          message:
            "Team not found"
        });
      }

      res.json({
        teamId:
          team._id,

        club:
          team.club,

        squad:
          team.players,

        bestXI:
          team.bestXI
      });
    } catch (error) {
      console.error(
        "Get Best XI error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch Best XI"
      });
    }
  }
);

/* =========================================================
   SAVE BEST XI DRAFT
========================================================= */

router.put(
  "/:id/best-xi",
  async (req, res) => {
    try {
      const {
        formation,
        players
      } = req.body;

      const team =
        await Team.findById(
          req.params.id
        );

      if (!team) {
        return res.status(404).json({
          message:
            "Team not found"
        });
      }

      if (
        team.bestXI?.submitted
      ) {
        return res.status(400).json({
          message:
            "Best XI has already been submitted and cannot be changed."
        });
      }

      if (
        !formation ||
        !Array.isArray(players)
      ) {
        return res.status(400).json({
          message:
            "Formation and players are required."
        });
      }

      const goalkeeper =
        Number(
          formation.goalkeeper
        );

      const defender =
        Number(
          formation.defender
        );

      const midfield =
        Number(
          formation.midfield
        );

      const attack =
        Number(
          formation.attack
        );

      if (
        goalkeeper !== 1
      ) {
        return res.status(400).json({
          message:
            "Exactly 1 goalkeeper is required."
        });
      }

      const total =
        goalkeeper +
        defender +
        midfield +
        attack;

      if (total !== 11) {
        return res.status(400).json({
          message:
            "Formation must contain exactly 11 players."
        });
      }

      if (
        defender < 2 ||
        defender > 5 ||
        midfield < 2 ||
        midfield > 5 ||
        attack < 1 ||
        attack > 5
      ) {
        return res.status(400).json({
          message:
            "Invalid formation combination."
        });
      }

      if (
        players.length !== 11
      ) {
        return res.status(400).json({
          message:
            "Exactly 11 players are required."
        });
      }

      const uniquePlayers =
        [
          ...new Set(
            players.map(
              (id) =>
                String(id)
            )
          )
        ];

      if (
        uniquePlayers.length !== 11
      ) {
        return res.status(400).json({
          message:
            "A player cannot be selected more than once."
        });
      }

      const squadIds =
        new Set(
          team.players.map(
            (id) =>
              String(id)
          )
        );

      for (
        const playerId of players
      ) {
        if (
          !squadIds.has(
            String(playerId)
          )
        ) {
          return res.status(400).json({
            message:
              "Best XI can only contain players from your squad."
          });
        }
      }

      const selectedPlayers =
        await Player.find({
          _id: {
            $in:
              players
          }
        });

      if (
        selectedPlayers.length !== 11
      ) {
        return res.status(400).json({
          message:
            "One or more selected players could not be found."
        });
      }

      const counts = {
        Goalkeeper: 0,
        Defender: 0,
        Midfielder: 0,
        Forward: 0
      };

      selectedPlayers.forEach(
        (player) => {
          counts[
            player.position
          ] += 1;
        }
      );

      if (
        counts.Goalkeeper !==
          goalkeeper ||
        counts.Defender !==
          defender ||
        counts.Midfielder !==
          midfield ||
        counts.Forward !==
          attack
      ) {
        return res.status(400).json({
          message:
            "Selected players do not match the chosen formation."
        });
      }

      team.bestXI = {
        submitted: false,

        formation: {
          goalkeeper,
          defender,
          midfield,
          attack
        },

        players,

        submittedAt: null
      };

      await team.save();

      const updatedTeam =
        await Team.findById(
          team._id
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
          .populate({
            path: "bestXI.players",
            select:
              "name age nationality position category rating image soldPrice"
          });

      res.json({
        message:
          "Best XI draft saved successfully.",

        bestXI:
          updatedTeam.bestXI
      });
    } catch (error) {
      console.error(
        "Save Best XI error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to save Best XI draft."
      });
    }
  }
);

/* =========================================================
   SUBMIT FINAL BEST XI
========================================================= */

router.post(
  "/:id/best-xi/submit",
  async (req, res) => {
    try {
      const {
        formation,
        players
      } = req.body;

      const team =
        await Team.findById(
          req.params.id
        );

      if (!team) {
        return res.status(404).json({
          message:
            "Team not found"
        });
      }

      if (
        team.bestXI?.submitted
      ) {
        return res.status(400).json({
          message:
            "Best XI has already been submitted."
        });
      }

      if (
        !formation ||
        !Array.isArray(players)
      ) {
        return res.status(400).json({
          message:
            "Formation and players are required."
        });
      }

      const goalkeeper =
        Number(
          formation.goalkeeper
        );

      const defender =
        Number(
          formation.defender
        );

      const midfield =
        Number(
          formation.midfield
        );

      const attack =
        Number(
          formation.attack
        );

      if (
        goalkeeper !== 1 ||
        goalkeeper +
          defender +
          midfield +
          attack !==
          11
      ) {
        return res.status(400).json({
          message:
            "Best XI must contain exactly 11 players and 1 goalkeeper."
        });
      }

      if (
        players.length !== 11
      ) {
        return res.status(400).json({
          message:
            "Exactly 11 players must be submitted."
        });
      }

      const uniquePlayers =
        [
          ...new Set(
            players.map(
              (id) =>
                String(id)
            )
          )
        ];

      if (
        uniquePlayers.length !==
        11
      ) {
        return res.status(400).json({
          message:
            "A player cannot be selected more than once."
        });
      }

      const squadIds =
        new Set(
          team.players.map(
            (id) =>
              String(id)
          )
        );

      for (
        const playerId of players
      ) {
        if (
          !squadIds.has(
            String(playerId)
          )
        ) {
          return res.status(400).json({
            message:
              "You can only submit players from your own squad."
          });
        }
      }

      const selectedPlayers =
        await Player.find({
          _id: {
            $in:
              players
          }
        });

      if (
        selectedPlayers.length !==
        11
      ) {
        return res.status(400).json({
          message:
            "One or more selected players could not be found."
        });
      }

      const counts = {
        Goalkeeper: 0,
        Defender: 0,
        Midfielder: 0,
        Forward: 0
      };

      selectedPlayers.forEach(
        (player) => {
          counts[
            player.position
          ] += 1;
        }
      );

      if (
        counts.Goalkeeper !==
          goalkeeper ||
        counts.Defender !==
          defender ||
        counts.Midfielder !==
          midfield ||
        counts.Forward !==
          attack
      ) {
        return res.status(400).json({
          message:
            "Selected players do not match the chosen formation."
        });
      }

      team.bestXI = {
        submitted: true,

        formation: {
          goalkeeper,
          defender,
          midfield,
          attack
        },

        players,

        submittedAt:
          new Date()
      };

      await team.save();

      const updatedTeams =
        await Team.find({
          isActive: true
        })
          .select(
            "club username purse players bestXI isActive"
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
          .populate({
            path: "bestXI.players",
            select:
              "name age nationality position category rating image soldPrice"
          });

      const io =
        req.app.get("io");

      if (io) {
        io.to(
          "auction-room"
        ).emit(
          "teams:update",
          updatedTeams
        );
      }

      const updatedTeam =
        updatedTeams.find(
          (item) =>
            String(item._id) ===
            String(team._id)
        );

      res.json({
        message:
          "Best XI submitted successfully.",

        bestXI:
          updatedTeam?.bestXI ||
          team.bestXI
      });
    } catch (error) {
      console.error(
        "Submit Best XI error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to submit Best XI."
      });
    }
  }
);

module.exports =
  router;