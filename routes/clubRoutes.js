const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const XLSX = require("xlsx");

const Club =
  require("../models/Club.js");

const router =
  express.Router();

const uploadRoot =
  path.join(
    __dirname,
    "..",
    "uploads"
  );

const clubUploadDir =
  path.join(
    uploadRoot,
    "clubs"
  );

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(
    uploadRoot,
    {
      recursive: true
    }
  );
}

if (
  !fs.existsSync(
    clubUploadDir
  )
) {
  fs.mkdirSync(
    clubUploadDir,
    {
      recursive: true
    }
  );
}

const storage =
  multer.diskStorage({
    destination:
      (req, file, cb) => {
        cb(
          null,
          uploadRoot
        );
      },

    filename:
      (req, file, cb) => {
        const safeName =
          file.originalname.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

        cb(
          null,
          `${Date.now()}_${safeName}`
        );
      }
  });

const upload =
  multer({
    storage,

    limits: {
      fileSize:
        50 * 1024 * 1024
    }
  });

function normalizeText(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function normalizeName(
  value
) {
  return normalizeText(
    value
  ).toLowerCase();
}

function normalizeKey(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s_-]+/g,
      ""
    );
}

function findColumn(
  row,
  possibleNames
) {
  for (
    const key of Object.keys(row)
  ) {
    if (
      possibleNames.includes(
        normalizeKey(
          key
        )
      )
    ) {
      return row[key];
    }
  }

  return "";
}

function safeFileName(
  fileName
) {
  return path
    .basename(
      fileName
    )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );
}

function readWorkbook(
  filePath
) {
  const workbook =
    XLSX.readFile(
      filePath
    );

  const sheetName =
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      "The Excel file has no worksheet."
    );
  }

  return XLSX.utils.sheet_to_json(
    workbook.Sheets[
      sheetName
    ],
    {
      defval: ""
    }
  );
}

function readZipImages(
  zipPath
) {
  const zip =
    new AdmZip(
      zipPath
    );

  const imageMap =
    new Map();

  for (
    const entry of
      zip.getEntries()
  ) {
    if (
      entry.isDirectory
    ) {
      continue;
    }

    const extension =
      path.extname(
        entry.entryName
      ).toLowerCase();

    if (
      ![
        ".png",
        ".jpg",
        ".jpeg",
        ".webp"
      ].includes(
        extension
      )
    ) {
      continue;
    }

    imageMap.set(
      path
        .basename(
          entry.entryName
        )
        .toLowerCase(),
      entry
    );
  }

  return imageMap;
}

function cleanupFile(
  filePath
) {
  try {
    if (
      filePath &&
      fs.existsSync(
        filePath
      )
    ) {
      fs.unlinkSync(
        filePath
      );
    }
  } catch {}
}

/* =========================================================
   ADD CLUB
========================================================= */

router.post(
  "/add",
  async (req, res) => {
    try {
      const name =
        normalizeText(
          req.body.name
        );

      const country =
        normalizeText(
          req.body.country
        );

      const logo =
        normalizeText(
          req.body.logo
        );

      if (!name) {
        return res.status(400).json({
          message:
            "Club name is required"
        });
      }

      const existingClub =
        await Club.findOne({
          name
        });

      if (existingClub) {
        return res.status(409).json({
          message:
            "Club already exists"
        });
      }

      const club =
        new Club({
          name,
          country,
          logo,
          assignedTo:
            null,
          isAvailable:
            true
        });

      await club.save();

      res.status(201).json({
        message:
          "Club added successfully",
        club
      });
    } catch (error) {
      console.error(
        "Add club error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Failed to add club"
      });
    }
  }
);

/* =========================================================
   PREVIEW IMPORT
========================================================= */

router.post(
  "/import/preview",
  upload.fields([
    {
      name:
        "clubFile",
      maxCount: 1
    },

    {
      name:
        "imageZip",
      maxCount: 1
    }
  ]),
  async (req, res) => {
    const clubFile =
      req.files?.clubFile?.[0];

    const imageZip =
      req.files?.imageZip?.[0];

    try {
      if (!clubFile) {
        return res.status(400).json({
          message:
            "Club Excel/CSV file is required."
        });
      }

      if (!imageZip) {
        return res.status(400).json({
          message:
            "Club image ZIP is required."
        });
      }

      const rows =
        readWorkbook(
          clubFile.path
        );

      const imageMap =
        readZipImages(
          imageZip.path
        );

      const preview = [];

      const namesSeen =
        new Set();

      let validRows = 0;
      let invalidRows = 0;
      let duplicateRows = 0;
      let existingAvailable = 0;
      let existingAssigned = 0;
      let missingImages = 0;

      for (
        const row of rows
      ) {
        const name =
          normalizeText(
            findColumn(
              row,
              [
                "name",
                "clubname",
                "club"
              ]
            )
          );

        const country =
          normalizeText(
            findColumn(
              row,
              [
                "country",
                "nation"
              ]
            )
          );

        const image =
          normalizeText(
            findColumn(
              row,
              [
                "image",
                "logo",
                "imagefile",
                "logofile"
              ]
            )
          );

        const normalized =
          normalizeName(
            name
          );

        let valid =
          true;

        let duplicate =
          false;

        let existing =
          false;

        let assigned =
          false;

        let imageFound =
          false;

        let action =
          "CREATE";

        if (!name) {
          valid =
            false;
        }

        if (
          namesSeen.has(
            normalized
          )
        ) {
          duplicate =
            true;

          duplicateRows++;

          valid =
            false;
        }

        namesSeen.add(
          normalized
        );

        const existingClub =
          name
            ? await Club.findOne({
                $expr: {
                  $eq: [
                    {
                      $toLower:
                        "$name"
                    },
                    normalized
                  ]
                }
              })
            : null;

        if (existingClub) {
          existing =
            true;

          if (
            existingClub.assignedTo
          ) {
            assigned =
              true;

            existingAssigned++;

            valid =
              false;

            action =
              "LOCKED";
          } else {
            existingAvailable++;

            action =
              "UPDATE";
          }
        }

        if (image) {
          imageFound =
            imageMap.has(
              image.toLowerCase()
            );
        }

        if (!imageFound) {
          missingImages++;

          valid =
            false;
        }

        if (valid) {
          validRows++;
        } else {
          invalidRows++;
        }

        preview.push({
          name,
          country,
          image,
          imageFound,
          duplicate,
          existing,
          assigned,
          action,
          valid
        });
      }

      res.json({
        totalRows:
          rows.length,

        validRows,

        invalidRows,

        duplicateRows,

        existingAvailable,

        existingAssigned,

        totalImages:
          imageMap.size,

        missingImages,

        preview
      });
    } catch (error) {
      console.error(
        "Club import preview error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Failed to preview club import."
      });
    } finally {
      cleanupFile(
        clubFile?.path
      );

      cleanupFile(
        imageZip?.path
      );
    }
  }
);

/* =========================================================
   IMPORT CLUBS
========================================================= */

router.post(
  "/import",
  upload.fields([
    {
      name:
        "clubFile",
      maxCount: 1
    },

    {
      name:
        "imageZip",
      maxCount: 1
    }
  ]),
  async (req, res) => {
    const clubFile =
      req.files?.clubFile?.[0];

    const imageZip =
      req.files?.imageZip?.[0];

    try {
      if (!clubFile) {
        return res.status(400).json({
          message:
            "Club Excel/CSV file is required."
        });
      }

      if (!imageZip) {
        return res.status(400).json({
          message:
            "Club image ZIP is required."
        });
      }

      const rows =
        readWorkbook(
          clubFile.path
        );

      const imageMap =
        readZipImages(
          imageZip.path
        );

      let created = 0;
      let updated = 0;
      let skipped = 0;

      const results = [];

      const processedNames =
        new Set();

      for (
        const row of rows
      ) {
        const name =
          normalizeText(
            findColumn(
              row,
              [
                "name",
                "clubname",
                "club"
              ]
            )
          );

        const country =
          normalizeText(
            findColumn(
              row,
              [
                "country",
                "nation"
              ]
            )
          );

        const image =
          normalizeText(
            findColumn(
              row,
              [
                "image",
                "logo",
                "imagefile",
                "logofile"
              ]
            )
          );

        if (!name) {
          skipped++;
          continue;
        }

        const normalized =
          normalizeName(
            name
          );

        if (
          processedNames.has(
            normalized
          )
        ) {
          skipped++;
          continue;
        }

        processedNames.add(
          normalized
        );

        const imageEntry =
          imageMap.get(
            image.toLowerCase()
          );

        if (!imageEntry) {
          skipped++;
          continue;
        }

        const existingClub =
          await Club.findOne({
            $expr: {
              $eq: [
                {
                  $toLower:
                    "$name"
                },
                normalized
              ]
            }
          });

        if (
          existingClub &&
          existingClub.assignedTo
        ) {
          skipped++;

          continue;
        }

        const outputName =
          `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}_${safeFileName(
              path.basename(
                imageEntry.entryName
              )
            )}`;

        const outputPath =
          path.join(
            clubUploadDir,
            outputName
          );

        fs.writeFileSync(
          outputPath,
          imageEntry.getData()
        );

        const logoPath =
          `/uploads/clubs/${outputName}`;

        if (existingClub) {
          existingClub.name =
            name;

          existingClub.country =
            country;

          existingClub.logo =
            logoPath;

          existingClub.isAvailable =
            true;

          existingClub.assignedTo =
            null;

          await existingClub.save();

          updated++;

          results.push({
            name,
            country,
            action:
              "UPDATED"
          });
        } else {
          const club =
            new Club({
              name,
              country,
              logo:
                logoPath,
              assignedTo:
                null,
              isAvailable:
                true
            });

          await club.save();

          created++;

          results.push({
            name,
            country,
            action:
              "CREATED"
          });
        }
      }

      res.status(201).json({
        message:
          "Club import completed successfully.",

        created,

        updated,

        skipped,

        imported:
          created +
          updated,

        clubs:
          results
      });
    } catch (error) {
      console.error(
        "Club import error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Failed to import clubs."
      });
    } finally {
      cleanupFile(
        clubFile?.path
      );

      cleanupFile(
        imageZip?.path
      );
    }
  }
);

/* =========================================================
   GET ALL CLUBS
========================================================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const clubs =
        await Club.find()
          .populate(
            "assignedTo",
            "username"
          )
          .sort({
            name: 1
          });

      res.json(
        clubs
      );
    } catch (error) {
      console.error(
        "Get clubs error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch clubs"
      });
    }
  }
);

/* =========================================================
   GET AVAILABLE CLUBS
========================================================= */

router.get(
  "/available",
  async (req, res) => {
    try {
      const clubs =
        await Club.find({
          isAvailable:
            true,
          assignedTo:
            null
        }).sort({
          name: 1
        });

      res.json(
        clubs
      );
    } catch (error) {
      console.error(
        "Get available clubs error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch available clubs"
      });
    }
  }
);

/* =========================================================
   DELETE CLUB
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const club =
        await Club.findById(
          req.params.id
        );

      if (!club) {
        return res.status(404).json({
          message:
            "Club not found"
        });
      }

      if (
        club.assignedTo
      ) {
        return res.status(400).json({
          message:
            "Assigned clubs cannot be deleted."
        });
      }

      await Club.findByIdAndDelete(
        req.params.id
      );

      res.json({
        message:
          "Club deleted successfully"
      });
    } catch (error) {
      console.error(
        "Delete club error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete club"
      });
    }
  }
);

module.exports =
  router;