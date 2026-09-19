require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./backend/src/config/database.js");
const authRoutes = require("./backend/src/routes/authRoutes.js");
const notFound = require("./backend/src/middleware/notFound.js");
const errorHandler = require("./backend/src/middleware/errorHandler.js");

const app = express();

if (process.env.MONGO_URI) {
	connectDB();
} else {
	console.log("MONGO_URI not set; running without MongoDB");
}

// global middlewares
app.use(cors());
app.use(express.json());
app.get("/ping", (req, res) => res.json({ data: "pong" }));
app.use("/api/auth", authRoutes);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Server is up and running on port ${port}`));

module.exports = app;