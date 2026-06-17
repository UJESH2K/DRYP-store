const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDatabase = async (mongoUri) => {
  try {
    if (!mongoUri) {
      throw new Error("MongoDB connection string is missing");
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info({ host: mongoose.connection.host }, "mongo_connected");
  } catch (error) {
    logger.error({ err: error.message }, "mongo_connection_error");
    throw error; // Let the caller handle the error
  }
};

module.exports = connectDatabase;
