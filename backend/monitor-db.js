require('dotenv').config();
const mongoose = require('mongoose');

// Import your models
const User = require('./src/models/User');
const Like = require('./src/models/Like');
const Order = require('./src/models/Order');

async function monitorDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔍 MongoDB Monitor Connected\n');

    // Function to display current database state
    async function showDatabaseState() {
      console.log('📊 CURRENT DATABASE STATE:');
      console.log('=' .repeat(50));

      try {
        // Check Users
        const users = await User.find({}).sort({ createdAt: -1 }).limit(10);
        console.log(`👥 USERS (${users.length} total):`);
        users.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.name} (${user.email}) - Created: ${user.createdAt}`);
        });

        // Check Likes
        const likes = await Like.find({}).populate('product').sort({ createdAt: -1 }).limit(10);
        console.log(`\n❤️ LIKES (${likes.length} total):`);
        likes.forEach((like, index) => {
          console.log(`  ${index + 1}. User: ${like.user} - Product: ${like.product || 'Unknown'} - Created: ${like.createdAt}`);
        });

        // Check Orders
        const orders = await Order.find({}).sort({ createdAt: -1 }).limit(10);
        console.log(`\n🛒 ORDERS (${orders.length} total):`);
        orders.forEach((order, index) => {
          console.log(`  ${index + 1}. User: ${order.user} - Status: ${order.status} - Items: ${order.items?.length || 0} - Created: ${order.createdAt}`);
        });

      } catch (error) {
        console.log('❌ Error reading database:', error.message);
      }

      console.log('=' .repeat(50));
      console.log(`🕐 Last updated: ${new Date().toLocaleTimeString()}\n`);
    }

    // Show initial state
    await showDatabaseState();

    // Monitor for changes every 5 seconds
    console.log('🔄 Monitoring database changes every 5 seconds...');
    console.log('Press Ctrl+C to stop monitoring\n');

    setInterval(async () => {
      await showDatabaseState();
    }, 5000);

  } catch (error) {
    console.error('❌ MongoDB Monitor Error:', error.message);
  }
}

monitorDatabase();
