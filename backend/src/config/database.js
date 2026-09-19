const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) return;

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
};

module.exports = connectDB;