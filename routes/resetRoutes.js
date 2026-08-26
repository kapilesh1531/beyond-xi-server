const express =
  require("express");

const mongoose =
  require("mongoose");

const Auction =
  mongoose.models.Auction;

const Team =
  mongoose.models.Team;

const Player =
  mongoose.models.Player;

const Club =
  mongoose.models.Club;

const router =
  express.Router();

router.post(
  "/auction",
  async (req, res) => {
    try {
      await Player.updateMany(
        {},
        {
          $set: {
            status:
              "Pool",

            activeForAuction:
              false,

            auctionOrder:
              null,

            soldTo:
              null,

            soldPrice:
              null
          }
        }
      );

      await Team.updateMany(
        {},
        {
          $set: {
            purse:
              200000000,

            players: [],

            bestXI: {
              submitted:
                false,

              formation: {
                goalkeeper:
                  1,

                defender:
                  4,

                midfield:
                  3,

                attack:
                  3
              },

              players: [],

              submittedAt:
                null
            }
          }
        }
      );

      await Auction.deleteMany(
        {}
      );

      const teams =
        await Team.find({})
          .select(
            "club"
          );

      const assignedClubIds =
        teams
          .map(
            (team) =>
              team.club
          )
          .filter(
            Boolean
          );

      await Club.updateMany(
        {},
        {
          $set: {
            isAvailable:
              true,

            assignedTo:
              null
          }
        }
      );

      if (
        assignedClubIds.length >
        0
      ) {
        await Club.updateMany(
          {
            _id: {
              $in:
                assignedClubIds
            }
          },
          {
            $set: {
              isAvailable:
                false,

              assignedTo:
                null
            }
          }
        );
      }

      const io =
        req.app.get(
          "io"
        );

      if (io) {
        const updatedTeams =
          await Team.find({
            isActive:
              true
          })
            .select(
              "club username purse players bestXI isActive"
            )
            .populate(
              "club",
              "name country logo"
            )
            .populate({
              path:
                "players",

              select:
                "name age nationality position category rating basePrice image status soldPrice"
            })
            .populate({
              path:
                "bestXI.players",

              select:
                "name age nationality position category rating image soldPrice"
            });

        const updatedPlayers =
          await Player.find()
            .sort({
              auctionOrder:
                1
            });

        io.to(
          "auction-room"
        ).emit(
          "teams:update",
          updatedTeams
        );

        io.to(
          "auction-room"
        ).emit(
          "players:update",
          updatedPlayers
        );

        io.to(
          "auction-room"
        ).emit(
          "auction:update",
          null
        );
      }

      res.json({
        message:
          "Auction reset successfully."
      });
    } catch (error) {
      console.error(
        "Reset auction error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Failed to reset auction."
      });
    }
  }
);

module.exports =
  router;