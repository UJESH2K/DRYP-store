const mongoose = require('mongoose');

// Map frontend product IDs to MongoDB ObjectIds
// This allows your frontend to use simple string IDs while backend uses proper ObjectIds
const PRODUCT_ID_MAPPING = {
  // CASUAL WEAR
  'casual_1': new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
  'casual_2': new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'), 
  'casual_3': new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
  'casual_4': new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
  'casual_5': new mongoose.Types.ObjectId('507f1f77bcf86cd799439015'),
  'casual_6': new mongoose.Types.ObjectId('507f1f77bcf86cd799439016'),

  // FORMAL WEAR  
  'formal_1': new mongoose.Types.ObjectId('507f1f77bcf86cd799439021'),
  'formal_2': new mongoose.Types.ObjectId('507f1f77bcf86cd799439022'),
  'formal_3': new mongoose.Types.ObjectId('507f1f77bcf86cd799439023'),
  'formal_4': new mongoose.Types.ObjectId('507f1f77bcf86cd799439024'),
  'formal_5': new mongoose.Types.ObjectId('507f1f77bcf86cd799439025'),
  'formal_6': new mongoose.Types.ObjectId('507f1f77bcf86cd799439026'),

  // STREETWEAR
  'street_1': new mongoose.Types.ObjectId('507f1f77bcf86cd799439031'),
  'street_2': new mongoose.Types.ObjectId('507f1f77bcf86cd799439032'),
  'street_3': new mongoose.Types.ObjectId('507f1f77bcf86cd799439033'),
  'street_4': new mongoose.Types.ObjectId('507f1f77bcf86cd799439034'),
  'street_5': new mongoose.Types.ObjectId('507f1f77bcf86cd799439035'),
  'street_6': new mongoose.Types.ObjectId('507f1f77bcf86cd799439036'),

  // SEASONAL
  'seasonal_1': new mongoose.Types.ObjectId('507f1f77bcf86cd799439041'),
  'seasonal_2': new mongoose.Types.ObjectId('507f1f77bcf86cd799439042'),
  'seasonal_3': new mongoose.Types.ObjectId('507f1f77bcf86cd799439043'),
  'seasonal_4': new mongoose.Types.ObjectId('507f1f77bcf86cd799439044'),
  'seasonal_5': new mongoose.Types.ObjectId('507f1f77bcf86cd799439045'),
  'seasonal_6': new mongoose.Types.ObjectId('507f1f77bcf86cd799439046'),

  // SPECIAL
  'special_1': new mongoose.Types.ObjectId('507f1f77bcf86cd799439051'),
  'special_2': new mongoose.Types.ObjectId('507f1f77bcf86cd799439052'),
  'special_3': new mongoose.Types.ObjectId('507f1f77bcf86cd799439053'),
  'special_4': new mongoose.Types.ObjectId('507f1f77bcf86cd799439054'),
  'special_5': new mongoose.Types.ObjectId('507f1f77bcf86cd799439055'),
  'special_6': new mongoose.Types.ObjectId('507f1f77bcf86cd799439056'),
};

// Convert frontend product ID to MongoDB ObjectId
function mapProductId(frontendId) {
  const mongoId = PRODUCT_ID_MAPPING[frontendId];
  if (!mongoId) {
    throw new Error(`Unknown product ID: ${frontendId}`);
  }
  return mongoId;
}

// Check if a frontend ID exists in mapping
function isValidProductId(frontendId) {
  return PRODUCT_ID_MAPPING.hasOwnProperty(frontendId);
}

// Get all mapped product IDs
function getAllMappedIds() {
  return Object.keys(PRODUCT_ID_MAPPING);
}

module.exports = {
  mapProductId,
  isValidProductId,
  getAllMappedIds,
  PRODUCT_ID_MAPPING
};
