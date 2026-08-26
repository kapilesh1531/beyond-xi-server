const express =
  require("express");

const mongoose =
  require("mongoose");

const cors =
  require("cors");

const path =
  require("path");

const http =
  require("http");

const {
  Server
} = require("socket.io");

require("dotenv").config();

const app =
  express();

const server =
  http.createServer(
    app
  );

/* =========================================================
   REGISTER MODELS ONLY ONCE
========================================================= */

require(
  "./models/Player"
);

require(
  "./models/Club"
);

require(
  "./models/Team"
);

require(
  "./models/Auction"
);

/* =========================================================
   ROUTES
========================================================= */

const authRoutes =
  require("./routes/authRoutes");

const teamRoutes =
  require("./routes/teamRoutes");

const adminTeamRoutes =
  require("./routes/adminTeamRoutes");

const clubRoutes =
  require("./routes/clubRoutes");

const playerRoutes =
  require("./routes/playerRoutes");

const poolRoutes =
  require("./routes/poolRoutes");

const auctionRoutes =
  require("./routes/auctionRoutes");

const resetRoutes =
  require("./routes/resetRoutes");

/* =========================================================
   SOCKET.IO
========================================================= */

const io =
  new Server(
    server,
    {
      cors: {
        origin:
          "http://localhost:5173",

        methods: [
          "GET",
          "POST",
          "PUT",
          "DELETE"
        ],

        credentials:
          true
      }
    }
  );

app.set(
  "io",
  io
);

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin:
      "http://localhost:5173",

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ],

    credentials:
      true
  })
);

app.use(
  express.json({
    limit:
      "10mb"
  })
);

app.use(
  express.urlencoded({
    extended:
      true,

    limit:
      "10mb"
  })
);

/* =========================================================
   UPLOADS
========================================================= */

app.use(
  "/uploads",
  express.static(
    path.join(
      __dirname,
      "uploads"
    )
  )
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success:
        true,

      message:
        "Beyond XI server is running",

      mongodb:
        mongoose.connection
          .readyState ===
        1
          ? "connected"
          : "disconnected"
    });
  }
);

/* =========================================================
   ROUTES
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/teams",
  teamRoutes
);

app.use(
  "/api/admin/teams",
  adminTeamRoutes
);

app.use(
  "/api/clubs",
  clubRoutes
);

app.use(
  "/api/players",
  playerRoutes
);

app.use(
  "/api/pool",
  poolRoutes
);

app.use(
  "/api/auction",
  auctionRoutes
);

app.use(
  "/api/reset",
  resetRoutes
);

/* =========================================================
   SOCKET EVENTS
========================================================= */

io.on(
  "connection",
  (socket) => {
    console.log(
      "User connected:",
      socket.id
    );

    socket.on(
      "joinAuction",
      () => {
        socket.join(
          "auction-room"
        );
      }
    );

    socket.on(
      "leaveAuction",
      () => {
        socket.leave(
          "auction-room"
        );
      }
    );

    socket.on(
      "disconnect",
      () => {
        console.log(
          "User disconnected:",
          socket.id
        );
      }
    );
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res.status(
      404
    ).json({
      message:
        "API route not found"
    });
  }
);

/* =========================================================
   ERROR
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Server error:",
      error
    );

    res.status(
      500
    ).json({
      message:
        error.message ||
        "Internal server error"
    });
  }
);

/* =========================================================
   DATABASE
========================================================= */

const PORT =
  process.env.PORT ||
  5000;

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error(
    "MONGO_URI is missing from .env"
  );

  process.exit(
    1
  );
}

/* =========================================================
   CLEAN OLD INDEXES
========================================================= */

async function removeOldIndexes() {
  const db =
    mongoose.connection.db;

  const oldClubIndexes = [
    "assignedTo_1",
    "assignedTo_unique_nonnull"
  ];

  for (
    const indexName of
      oldClubIndexes
  ) {
    try {
      await db
        .collection("clubs")
        .dropIndex(
          indexName
        );

      console.log(
        `Removed old club index: ${indexName}`
      );
    } catch (error) {
      if (
        error.codeName ===
        "IndexNotFound"
      ) {
        console.log(
          `Club index ${indexName} not found.`
        );
      }
    }
  }

  try {
    await db
      .collection("teams")
      .dropIndex(
        "teamName_1"
      );

    console.log(
      "Removed old teamName_1 index."
    );
  } catch (error) {
    if (
      error.codeName ===
      "IndexNotFound"
    ) {
      console.log(
        "teamName_1 not found."
      );
    }
  }
}

/* =========================================================
   START SERVER
========================================================= */

mongoose
  .connect(
    MONGO_URI
  )
  .then(
    async () => {
      console.log(
        "MongoDB connected successfully"
      );

      await removeOldIndexes();

      console.log(
        "Database cleanup completed."
      );

      server.listen(
        PORT,
        () => {
          console.log(
            `Beyond XI server running on http://localhost:${PORT}`
          );
        }
      );
    }
  )
  .catch(
    (error) => {
      console.error(
        "MongoDB connection error:",
        error
      );

      process.exit(
        1
      );
    }
  );