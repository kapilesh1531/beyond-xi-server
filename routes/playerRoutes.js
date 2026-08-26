const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const AdmZip = require("adm-zip");
const mongoose = require("mongoose");

const Team = require("../models/Team");
const Auction = require("../models/Auction");

const Player = mongoose.models.Player;

const router = express.Router();

/* =========================================================
   IMAGE STORAGE
========================================================= */

const imageStorage =
  multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(
        __dirname,
        "..",
        "uploads"
      );

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, {
          recursive: true
        });
      }

      cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
      const uniqueName =
        Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname);

      cb(null, uniqueName);
    }
  });

const imageUpload =
  multer({
    storage: imageStorage,

    limits: {
      fileSize:
        5 * 1024 * 1024
    },

    fileFilter: (
      req,
      file,
      cb
    ) => {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
      ];

      if (
        !allowedTypes.includes(
          file.mimetype
        )
      ) {
        return cb(
          new Error(
            "Only JPG, JPEG, PNG and WEBP images are allowed."
          )
        );
      }

      cb(null, true);
    }
  });

/* =========================================================
   IMPORT STORAGE
========================================================= */

const importUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        50 * 1024 * 1024
    },

    fileFilter: (
      req,
      file,
      cb
    ) => {
      const extension =
        path
          .extname(
            file.originalname
          )
          .toLowerCase();

      if (
        file.fieldname ===
        "playerFile"
      ) {
        if (
          ![
            ".csv",
            ".xlsx",
            ".xls"
          ].includes(
            extension
          )
        ) {
          return cb(
            new Error(
              "Player file must be CSV, XLSX or XLS."
            )
          );
        }
      }

      if (
        file.fieldname ===
        "imageZip"
      ) {
        if (
          extension !==
          ".zip"
        ) {
          return cb(
            new Error(
              "Player images must be uploaded as a ZIP file."
            )
          );
        }
      }

      cb(null, true);
    }
  });

/* =========================================================
   VALID VALUES
========================================================= */

const validPositions = [
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Forward"
];

const validCategories = [
  "Elite",
  "World Class",
  "High Quality",
  "Rising/Value"
];

const allowedImageExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
];

/* =========================================================
   NORMALIZE EXCEL ROW
========================================================= */

function normalizeRow(row) {
  return {
    name: String(
      row.Name ??
      row.name ??
      ""
    ).trim(),

    age: Number(
      row.Age ??
      row.age
    ),

    nationality: String(
      row.Nationality ??
      row.nationality ??
      ""
    ).trim(),

    position: String(
      row.Position ??
      row.position ??
      ""
    ).trim(),

    category: String(
      row.Category ??
      row.category ??
      ""
    ).trim(),

    rating: Number(
      row.Rating ??
      row.rating
    ),

    basePrice: Number(
      row.BasePrice ??
      row["Base Price"] ??
      row.basePrice
    ),

    image: String(
      row.Image ??
      row.image ??
      ""
    ).trim()
  };
}

/* =========================================================
   VALIDATE PLAYER
========================================================= */

function validatePlayerRow(
  row,
  index
) {
  const errors = [];

  if (!row.name) {
    errors.push(
      "Player name is required"
    );
  }

  if (
    row.age === undefined ||
    row.age === null ||
    row.age === "" ||
    !Number.isFinite(
      Number(row.age)
    )
  ) {
    errors.push(
      "Valid age is required"
    );
  }

  if (!row.nationality) {
    errors.push(
      "Nationality is required"
    );
  }

  if (!row.position) {
    errors.push(
      "Position is required"
    );
  } else if (
    !validPositions.includes(
      row.position
    )
  ) {
    errors.push(
      `Invalid position "${row.position}"`
    );
  }

  if (!row.category) {
    errors.push(
      "Category is required"
    );
  } else if (
    !validCategories.includes(
      row.category
    )
  ) {
    errors.push(
      `Invalid category "${row.category}"`
    );
  }

  if (
    row.rating === undefined ||
    row.rating === null ||
    row.rating === "" ||
    !Number.isFinite(
      Number(row.rating)
    )
  ) {
    errors.push(
      "Valid rating is required"
    );
  } else if (
    Number(row.rating) < 1 ||
    Number(row.rating) > 100
  ) {
    errors.push(
      "Rating must be between 1 and 100"
    );
  }

  if (
    row.basePrice === undefined ||
    row.basePrice === null ||
    row.basePrice === "" ||
    !Number.isFinite(
      Number(row.basePrice)
    )
  ) {
    errors.push(
      "Valid base price is required"
    );
  } else if (
    Number(row.basePrice) < 0
  ) {
    errors.push(
      "Base price cannot be negative"
    );
  }

  if (!row.image) {
    errors.push(
      "Image filename is required"
    );
  }

  return {
    rowNumber: index + 2,
    errors
  };
}

/* =========================================================
   PARSE EXCEL
========================================================= */

function parseImportFile(
  buffer
) {
  const workbook =
    XLSX.read(
      buffer,
      {
        type: "buffer"
      }
    );

  const sheetName =
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      "The uploaded file has no worksheet."
    );
  }

  return XLSX.utils.sheet_to_json(
    workbook.Sheets[sheetName],
    {
      defval: ""
    }
  );
}

/* =========================================================
   READ ZIP IMAGES
========================================================= */

function readZipImages(
  zipBuffer
) {
  const zip =
    new AdmZip(zipBuffer);

  const imageEntries =
    zip
      .getEntries()
      .filter(
        (entry) => {
          if (
            entry.isDirectory
          ) {
            return false;
          }

          const extension =
            path
              .extname(
                entry.entryName
              )
              .toLowerCase();

          return allowedImageExtensions.includes(
            extension
          );
        }
      );

  const imageMap =
    new Map();

  for (
    const entry of imageEntries
  ) {
    const filename =
      path
        .basename(
          entry.entryName
        )
        .toLowerCase();

    imageMap.set(
      filename,
      entry.getData()
    );
  }

  return imageMap;
}

/* =========================================================
   IMAGE ISSUES
========================================================= */

function getImageIssues(
  rows,
  imageMap
) {
  const missingImages = [];
  const duplicateImageReferences = [];
  const referencedImages = new Set();

  rows.forEach(
    (
      row,
      index
    ) => {
      const filename =
        path
          .basename(
            row.image
          )
          .toLowerCase();

      if (!filename) {
        return;
      }

      if (
        !imageMap.has(
          filename
        )
      ) {
        missingImages.push({
          rowNumber:
            index + 2,
          player:
            row.name,
          image:
            row.image
        });
      }

      if (
        referencedImages.has(
          filename
        )
      ) {
        duplicateImageReferences.push({
          rowNumber:
            index + 2,
          player:
            row.name,
          image:
            row.image
        });
      }

      referencedImages.add(
        filename
      );
    }
  );

  return {
    missingImages,
    duplicateImageReferences
  };
}

/* =========================================================
   PREVIEW IMPORT
========================================================= */

router.post(
  "/import/preview",
  importUpload.fields([
    {
      name: "playerFile",
      maxCount: 1
    },
    {
      name: "imageZip",
      maxCount: 1
    }
  ]),
  async (req, res) => {
    try {
      const playerFile =
        req.files
          ?.playerFile?.[0];

      const imageZip =
        req.files
          ?.imageZip?.[0];

      if (!playerFile) {
        return res.status(400).json({
          message:
            "Please upload the Excel or CSV player file."
        });
      }

      if (!imageZip) {
        return res.status(400).json({
          message:
            "Please upload the ZIP containing player images."
        });
      }

      const rawRows =
        parseImportFile(
          playerFile.buffer
        );

      if (
        rawRows.length === 0
      ) {
        return res.status(400).json({
          message:
            "The player file contains no data."
        });
      }

      const rows =
        rawRows.map(
          normalizeRow
        );

      const validationResults =
        rows.map(
          (
            row,
            index
          ) =>
            validatePlayerRow(
              row,
              index
            )
        );

      const invalidRows =
        validationResults.filter(
          (result) =>
            result.errors.length >
            0
        );

      const validRows =
        rows.filter(
          (
            _,
            index
          ) =>
            validationResults[
              index
            ].errors.length ===
            0
        );

      const imageMap =
        readZipImages(
          imageZip.buffer
        );

      const imageIssues =
        getImageIssues(
          rows,
          imageMap
        );

      const duplicateNames = [];
      const seenNames = new Set();

      rows.forEach(
        (
          row,
          index
        ) => {
          const lowerName =
            row.name.toLowerCase();

          if (
            lowerName &&
            seenNames.has(
              lowerName
            )
          ) {
            duplicateNames.push({
              rowNumber:
                index + 2,
              name:
                row.name
            });
          }

          if (lowerName) {
            seenNames.add(
              lowerName
            );
          }
        }
      );

      const playerNames =
        rows
          .map(
            (row) =>
              row.name
          )
          .filter(Boolean);

      const existingPlayers =
        await Player.find(
          {
            name: {
              $in:
                playerNames
            }
          },
          {
            name: 1
          }
        );

      const existingNames =
        new Set(
          existingPlayers.map(
            (player) =>
              player.name.toLowerCase()
          )
        );

      const alreadyInDatabase =
        rows
          .map(
            (
              row,
              index
            ) => ({
              rowNumber:
                index + 2,
              name:
                row.name
            })
          )
          .filter(
            (item) =>
              existingNames.has(
                item.name.toLowerCase()
              )
          );

      res.json({
        message:
          "Preview generated successfully",

        totalRows:
          rows.length,

        validRows:
          validRows.length,

        invalidRows:
          invalidRows.length,

        duplicateRows:
          duplicateNames.length,

        alreadyInDatabase:
          alreadyInDatabase.length,

        totalImages:
          imageMap.size,

        missingImages:
          imageIssues
            .missingImages
            .length,

        duplicateImageReferences:
          imageIssues
            .duplicateImageReferences
            .length,

        preview:
          validRows.map(
            (row) => ({
              ...row,
              imageFound:
                imageMap.has(
                  path
                    .basename(
                      row.image
                    )
                    .toLowerCase()
                )
            })
          ),

        errors:
          invalidRows,

        duplicates:
          duplicateNames,

        existingPlayers:
          alreadyInDatabase,

        missingImageDetails:
          imageIssues
            .missingImages,

        duplicateImageDetails:
          imageIssues
            .duplicateImageReferences
      });
    } catch (error) {
      console.error(
        "Import preview error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Failed to preview player import."
      });
    }
  }
);

/* =========================================================
   IMPORT PLAYERS + IMAGES
========================================================= */

router.post(
  "/import",
  importUpload.fields([
    {
      name: "playerFile",
      maxCount: 1
    },
    {
      name: "imageZip",
      maxCount: 1
    }
  ]),
  async (req, res) => {
    try {
      const playerFile =
        req.files
          ?.playerFile?.[0];

      const imageZip =
        req.files
          ?.imageZip?.[0];

      if (!playerFile) {
        return res.status(400).json({
          message:
            "Please upload the Excel or CSV player file."
        });
      }

      if (!imageZip) {
        return res.status(400).json({
          message:
            "Please upload the ZIP containing player images."
        });
      }

      const rawRows =
        parseImportFile(
          playerFile.buffer
        );

      const rows =
        rawRows.map(
          normalizeRow
        );

      const validationErrors = [];
      const validRows = [];

      rows.forEach(
        (
          row,
          index
        ) => {
          const validation =
            validatePlayerRow(
              row,
              index
            );

          if (
            validation.errors.length >
            0
          ) {
            validationErrors.push(
              validation
            );
          } else {
            validRows.push(
              row
            );
          }
        }
      );

      const imageMap =
        readZipImages(
          imageZip.buffer
        );

      const imageIssues =
        getImageIssues(
          validRows,
          imageMap
        );

      if (
        validationErrors.length >
        0
      ) {
        return res.status(400).json({
          message:
            "Some player rows contain validation errors.",
          errors:
            validationErrors
        });
      }

      if (
        imageIssues
          .missingImages
          .length >
        0
      ) {
        return res.status(400).json({
          message:
            "Some player images are missing from the ZIP.",
          missingImages:
            imageIssues.missingImages
        });
      }

      const uniqueRows = [];
      const seenNames = new Set();

      for (
        const row of validRows
      ) {
        const lowerName =
          row.name.toLowerCase();

        if (
          seenNames.has(
            lowerName
          )
        ) {
          continue;
        }

        seenNames.add(
          lowerName
        );

        uniqueRows.push(
          row
        );
      }

      const existingPlayers =
        await Player.find(
          {
            name: {
              $in:
                uniqueRows.map(
                  (row) =>
                    row.name
                )
            }
          },
          {
            name: 1
          }
        );

      const existingNames =
        new Set(
          existingPlayers.map(
            (player) =>
              player.name.toLowerCase()
          )
        );

      const uploadDirectory =
        path.join(
          __dirname,
          "..",
          "uploads"
        );

      if (
        !fs.existsSync(
          uploadDirectory
        )
      ) {
        fs.mkdirSync(
          uploadDirectory,
          {
            recursive:
              true
          }
        );
      }

      const playersToInsert = [];

      for (
        const row of uniqueRows
      ) {
        if (
          existingNames.has(
            row.name.toLowerCase()
          )
        ) {
          continue;
        }

        const imageFilename =
          path
            .basename(
              row.image
            )
            .toLowerCase();

        const imageBuffer =
          imageMap.get(
            imageFilename
          );

        if (!imageBuffer) {
          continue;
        }

        const extension =
          path
            .extname(
              imageFilename
            )
            .toLowerCase();

        const uniqueFilename =
          Date.now() +
          "-" +
          Math.round(
            Math.random() *
              1e9
          ) +
          extension;

        fs.writeFileSync(
          path.join(
            uploadDirectory,
            uniqueFilename
          ),
          imageBuffer
        );

        playersToInsert.push({
          name:
            row.name,

          age:
            row.age,

          nationality:
            row.nationality,

          position:
            row.position,

          category:
            row.category,

          rating:
            row.rating,

          basePrice:
            row.basePrice,

          image:
            `/uploads/${uniqueFilename}`,

          status:
            "Available",

          activeForAuction:
            true,

          auctionOrder:
            null,

          soldTo:
            null,

          soldPrice:
            null
        });
      }

      if (
        playersToInsert.length ===
        0
      ) {
        return res.status(400).json({
          message:
            "No new players are available to import."
        });
      }

      await Player.insertMany(
        playersToInsert
      );

      res.status(201).json({
        message:
          "Players and images imported successfully.",

        imported:
          playersToInsert.length,

        skipped:
          uniqueRows.length -
          playersToInsert.length
      });
    } catch (error) {
      console.error(
        "Bulk player import error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Failed to import players and images."
      });
    }
  }
);

/* =========================================================
   PREPARE EXISTING PLAYERS
========================================================= */

router.post(
  "/prepare-auction",
  async (req, res) => {
    try {
      const result =
        await Player.updateMany(
          {
            status:
              "Available",

            soldTo:
              null
          },
          {
            $set: {
              activeForAuction:
                true,

              auctionOrder:
                null
            }
          }
        );

      res.json({
        message:
          "Available players prepared for auction.",

        activated:
          result.modifiedCount
      });
    } catch (error) {
      console.error(
        "Prepare auction error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to prepare players for auction."
      });
    }
  }
);

/* =========================================================
   ADD SINGLE PLAYER
========================================================= */

router.post(
  "/add",
  imageUpload.single("image"),
  async (req, res) => {
    try {
      const {
        name,
        age,
        nationality,
        position,
        category,
        rating,
        basePrice
      } = req.body;

      if (
        !name ||
        !age ||
        !nationality ||
        !position ||
        !category ||
        rating === undefined ||
        basePrice === undefined
      ) {
        return res.status(400).json({
          message:
            "Please fill in all required player details."
        });
      }

      const existingPlayer =
        await Player.findOne({
          name:
            name.trim()
        });

      if (existingPlayer) {
        return res.status(409).json({
          message:
            "A player with this name already exists."
        });
      }

      const player =
        new Player({
          name:
            name.trim(),

          age:
            Number(age),

          nationality:
            nationality.trim(),

          position,

          category,

          rating:
            Number(rating),

          basePrice:
            Number(basePrice),

          image:
            req.file
              ? `/uploads/${req.file.filename}`
              : "",

          status:
            "Available",

          activeForAuction:
            true,

          auctionOrder:
            null,

          soldTo:
            null,

          soldPrice:
            null
        });

      await player.save();

      res.status(201).json({
        message:
          "Player created successfully",

        player
      });
    } catch (error) {
      console.error(
        "Add player error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Failed to create player."
      });
    }
  }
);

/* =========================================================
   DELETE ONE PLAYER
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const player =
        await Player.findById(
          req.params.id
        );

      if (!player) {
        return res.status(404).json({
          message:
            "Player not found."
        });
      }

      if (
        player.status ===
        "Sold"
      ) {
        return res.status(400).json({
          message:
            "Sold players cannot be deleted."
        });
      }

      await Player.findByIdAndDelete(
        req.params.id
      );

      res.json({
        message:
          "Player deleted successfully."
      });
    } catch (error) {
      console.error(
        "Delete player error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete player."
      });
    }
  }
);

/* =========================================================
   DELETE SELECTED PLAYERS
========================================================= */

router.post(
  "/delete-selected",
  async (req, res) => {
    try {
      const {
        playerIds
      } = req.body;

      if (
        !Array.isArray(
          playerIds
        ) ||
        playerIds.length === 0
      ) {
        return res.status(400).json({
          message:
            "No players selected."
        });
      }

      const selectedPlayers =
        await Player.find({
          _id: {
            $in:
              playerIds
          }
        });

      const soldPlayers =
        selectedPlayers.filter(
          (player) =>
            player.status ===
            "Sold"
        );

      if (
        soldPlayers.length > 0
      ) {
        return res.status(400).json({
          message:
            "Sold players cannot be deleted individually. Use Reset Auction or Delete All for a complete reset."
        });
      }

      const result =
        await Player.deleteMany({
          _id: {
            $in:
              playerIds
          }
        });

      res.json({
        message:
          "Selected players deleted successfully.",

        deleted:
          result.deletedCount
      });
    } catch (error) {
      console.error(
        "Delete selected players error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete selected players."
      });
    }
  }
);

/* =========================================================
   DELETE ALL PLAYERS
========================================================= */

router.delete(
  "/all/clear",
  async (req, res) => {
    try {
      await Team.updateMany(
        {},
        {
          $set: {
            players: []
          }
        }
      );

      await Auction.deleteMany({});

      const result =
        await Player.deleteMany({});

      const io =
        req.app.get("io");

      if (io) {
        const teams =
          await Team.find({
            isActive:
              true
          })
            .select(
              "username purse club players isActive"
            )
            .populate({
              path:
                "club",
              select:
                "name country logo"
            })
            .populate({
              path:
                "players",
              select:
                "name age nationality position category rating basePrice image status soldPrice"
            });

        io.to(
          "auction-room"
        ).emit(
          "auction:update",
          null
        );

        io.to(
          "auction-room"
        ).emit(
          "players:update",
          []
        );

        io.to(
          "auction-room"
        ).emit(
          "teams:update",
          teams
        );
      }

      res.json({
        message:
          "All players deleted successfully. Team squads and old auction records were also cleared.",

        deleted:
          result.deletedCount
      });
    } catch (error) {
      console.error(
        "Delete all players error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete all players."
      });
    }
  }
);

/* =========================================================
   GET ALL PLAYERS
========================================================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const players =
        await Player.find()
          .sort({
            createdAt:
              -1
          });

      res.json(
        players
      );
    } catch (error) {
      console.error(
        "Get players error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch players."
      });
    }
  }
);

/* =========================================================
   GET ONE PLAYER
========================================================= */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const player =
        await Player.findById(
          req.params.id
        );

      if (!player) {
        return res.status(404).json({
          message:
            "Player not found."
        });
      }

      res.json(
        player
      );
    } catch (error) {
      console.error(
        "Get player error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch player."
      });
    }
  }
);

module.exports =
  router;