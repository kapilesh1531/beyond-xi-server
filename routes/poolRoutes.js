const express = require("express");
const mongoose = require("mongoose");

const Player =
  mongoose.models.Player;

const router =
  express.Router();

const PLAYERS_PER_TEAM = 20;
const MAX_POOL = 400;
const SQUAD_SIZE = 15;

const CATEGORY_RATIO = {
  Elite: 0.10,
  "World Class": 0.25,
  "High Quality": 0.40,
  "Rising/Value": 0.25
};

function getPoolSize(
  teamCount
) {
  return Math.min(
    teamCount *
      PLAYERS_PER_TEAM,
    MAX_POOL
  );
}

function getCategoryCounts(
  poolSize
) {
  const elite =
    Math.floor(
      poolSize *
        CATEGORY_RATIO.Elite
    );

  const worldClass =
    Math.floor(
      poolSize *
        CATEGORY_RATIO["World Class"]
    );

  const highQuality =
    Math.floor(
      poolSize *
        CATEGORY_RATIO["High Quality"]
    );

  const risingValue =
    poolSize -
    elite -
    worldClass -
    highQuality;

  return {
    Elite: elite,
    "World Class":
      worldClass,
    "High Quality":
      highQuality,
    "Rising/Value":
      risingValue
  };
}

function shuffle(
  array
) {
  return [...array].sort(
    () =>
      Math.random() -
      0.5
  );
}

router.get(
  "/recommendation",
  async (req, res) => {
    try {
      const teamCount =
        Number(
          req.query.teams
        );

      if (
        !Number.isInteger(
          teamCount
        ) ||
        teamCount < 1
      ) {
        return res.status(400).json({
          message:
            "Invalid team count"
        });
      }

      const recommendedPool =
        getPoolSize(
          teamCount
        );

      const requiredPlayers =
        teamCount *
        SQUAD_SIZE;

      const categoryBreakdown =
        getCategoryCounts(
          recommendedPool
        );

      const masterPoolSize =
        await Player.countDocuments();

      const unusedPlayers =
        await Player.countDocuments({
          status:
            "Pool",

          activeForAuction:
            false
        });

      res.json({
        teamCount,

        playersPerTeam:
          PLAYERS_PER_TEAM,

        squadSize:
          SQUAD_SIZE,

        requiredPlayers,

        recommendedPool,

        maximumPool:
          MAX_POOL,

        masterPoolSize,

        unusedPlayers,

        categoryBreakdown
      });
    } catch (error) {
      console.error(
        "Pool recommendation error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to calculate player pool"
      });
    }
  }
);

router.post(
  "/activate",
  async (req, res) => {
    try {
      const teamCount =
        Number(
          req.body.teamCount
        );

      if (
        !Number.isInteger(
          teamCount
        ) ||
        teamCount < 1
      ) {
        return res.status(400).json({
          message:
            "Invalid team count"
        });
      }

      const poolSize =
        getPoolSize(
          teamCount
        );

      const requiredPlayers =
        teamCount *
        SQUAD_SIZE;

      if (
        poolSize <
        requiredPlayers
      ) {
        return res.status(400).json({
          message:
            "Calculated pool is smaller than the required squad capacity"
        });
      }

      const categoryCounts =
        getCategoryCounts(
          poolSize
        );

      const selectedPlayers =
        [];

      for (
        const category of Object.keys(
          categoryCounts
        )
      ) {
        const required =
          categoryCounts[
            category
          ];

        const players =
          await Player.find({
            category,

            status:
              "Pool",

            activeForAuction:
              false
          });

        if (
          players.length <
          required
        ) {
          return res.status(400).json({
            message:
              `Not enough ${category} players in the master pool. Required: ${required}, available: ${players.length}`
          });
        }

        selectedPlayers.push(
          ...shuffle(
            players
          ).slice(
            0,
            required
          )
        );
      }

      await Player.updateMany(
        {},
        {
          $set: {
            activeForAuction:
              false,

            auctionOrder:
              null
          }
        }
      );

      const operations =
        selectedPlayers.map(
          (
            player,
            index
          ) => ({
            updateOne: {
              filter: {
                _id:
                  player._id
              },

              update: {
                $set: {
                  activeForAuction:
                    true,

                  status:
                    "Available",

                  auctionOrder:
                    index + 1
                }
              }
            }
          })
        );

      await Player.bulkWrite(
        operations
      );

      res.json({
        message:
          "Auction pool activated successfully",

        teamCount,

        playersPerTeam:
          PLAYERS_PER_TEAM,

        squadSize:
          SQUAD_SIZE,

        requiredPlayers,

        activePool:
          poolSize,

        categoryBreakdown:
          categoryCounts
      });
    } catch (error) {
      console.error(
        "Activate pool error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to activate auction pool"
      });
    }
  }
);

router.get(
  "/active",
  async (req, res) => {
    try {
      const players =
        await Player.find({
          activeForAuction:
            true
        }).sort({
          auctionOrder:
            1
        });

      res.json({
        count:
          players.length,

        players
      });
    } catch (error) {
      console.error(
        "Get active pool error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch active pool"
      });
    }
  }
);

router.post(
  "/clear",
  async (req, res) => {
    try {
      const result =
        await Player.updateMany(
          {
            activeForAuction:
              true,

            status: {
              $in: [
                "Available",
                "Pool"
              ]
            }
          },

          {
            $set: {
              activeForAuction:
                false,

              auctionOrder:
                null,

              status:
                "Pool"
            }
          }
        );

      res.json({
        message:
          "Auction pool cleared",

        cleared:
          result.modifiedCount
      });
    } catch (error) {
      console.error(
        "Clear pool error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to clear auction pool"
      });
    }
  }
);

module.exports =
  router;