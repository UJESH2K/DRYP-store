const mongoose = require('mongoose');

const connectDatabase = async (mongoUri) => {
  try {
    if (!mongoUri) {
      throw new Error('MongoDB connection string is missing');
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error; // Let the caller handle the error
  }
};

module.exports = connectDatabase;


