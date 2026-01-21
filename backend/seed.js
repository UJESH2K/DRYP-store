require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDatabase = require('./src/config/database');
const Product = require('./src/models/Product');
const User = require('./src/models/User');

const VENDOR_ID = '691dfd25d9164020524efb23';
const PLACEHOLDER_IMAGE = '/uploads/seed-placeholder.jpg';

const sampleProducts = [
  {
    name: 'Casa Denim Jacket',
    description: 'A timeless denim jacket for all seasons. Made with 100% organic cotton, this jacket features a classic button-front, two chest pockets, and a comfortable fit that layers perfectly over any outfit. A wardrobe staple for a reason.',
    brand: 'Casa Denim',
    category: 'Jackets',
    tags: ['Outerwear', 'Denim', 'Casual', 'Staple'],
    basePrice: 129.99,
    images: [PLACEHOLDER_IMAGE],
    vendor: VENDOR_ID,
    isActive: true,
    options: [
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
      { name: 'Color', values: ['Classic Blue', 'Washed Black'] }
    ],
    variants: [
      { options: { Size: 'S', Color: 'Classic Blue' }, stock: 10, price: 129.99, images: [PLACEHOLDER_IMAGE] },
      { options: { Size: 'M', Color: 'Classic Blue' }, stock: 15, price: 129.99, images: [PLACEHOLDER_IMAGE] },
      { options: { Size: 'L', Color: 'Classic Blue' }, stock: 12, price: 129.99, images: [PLACEHOLDER_IMAGE] },
      { options: { Size: 'XL', Color: 'Classic Blue' }, stock: 8, price: 129.99, images: [PLACEHOLDER_IMAGE] },
      { options: { Size: 'S', Color: 'Washed Black' }, stock: 8, price: 134.99, images: [PLACEHOLDER_IMAGE] },
      { options: { Size: 'M', Color: 'Washed Black' }, stock: 18, price: 134.99, images: [PLACEHOLDER_IMAGE] },
      { options: { Size: 'L', Color: 'Washed Black' }, stock: 10, price: 134.99, images: [PLACEHOLDER_IMAGE] },
    ],
  },
  {
    name: 'Zenith Crewneck Tee',
    description: 'The perfect crewneck t-shirt, crafted from ultra-soft pima cotton. Breathable, durable, and designed for a modern, tailored fit. Available in a range of essential colors.',
    brand: 'Zenith',
    category: 'T-Shirts',
    tags: ['Basics', 'Pima Cotton', 'Essential'],
    basePrice: 45.00,
    images: [PLACEHOLDER_IMAGE],
    vendor: VENDOR_ID,
    isActive: true,
    options: [
      { name: 'Size', values: ['S', 'M', 'L'] },
      { name: 'Color', values: ['Optic White', 'Heather Grey', 'Charcoal'] }
    ],
    variants: [
      { options: { Size: 'S', Color: 'Optic White' }, stock: 30, price: 45.00 },
      { options: { Size: 'M', Color: 'Optic White' }, stock: 40, price: 45.00 },
      { options: { Size: 'L', Color: 'Optic White' }, stock: 35, price: 45.00 },
      { options: { Size: 'M', Color: 'Heather Grey' }, stock: 25, price: 45.00 },
      { options: { Size: 'L', Color: 'Heather Grey' }, stock: 22, price: 45.00 },
      { options: { Size: 'M', Color: 'Charcoal' }, stock: 28, price: 45.00 },
    ],
  },
  {
    name: 'Nomad Tech Chinos',
    description: 'Versatile chinos made with a four-way stretch, water-resistant fabric. Perfect for travel, commuting, or a smart-casual look. Features a secure zip pocket.',
    brand: 'AER Travel',
    category: 'Pants',
    tags: ['Performance', 'Travel', 'Chinos', 'Water-Resistant'],
    basePrice: 98.00,
    images: [PLACEHOLDER_IMAGE],
    vendor: VENDOR_ID,
    isActive: true,
    options: [
      { name: 'Waist', values: ['30', '32', '34'] },
      { name: 'Color', values: ['Khaki', 'Navy Blue'] }
    ],
    variants: [
      { options: { Waist: '30', Color: 'Khaki' }, stock: 15, price: 98.00 },
      { options: { Waist: '32', Color: 'Khaki' }, stock: 20, price: 98.00 },
      { options: { Waist: '34', Color: 'Khaki' }, stock: 18, price: 98.00 },
      { options: { Waist: '32', Color: 'Navy Blue' }, stock: 17, price: 98.00 },
      { options: { Waist: '34', Color: 'Navy Blue' }, stock: 15, price: 98.00 },
    ],
  },
  {
    name: 'Artisan Leather Belt',
    description: 'A handsome and durable belt crafted from full-grain Italian leather that will develop a unique patina over time. Finished with a solid brass buckle.',
    brand: 'Heritage Craft',
    category: 'Accessories',
    tags: ['Leather', 'Belt', 'Handmade'],
    basePrice: 75.50,
    // This is a simple product with no variants
    stock: 50,
    images: [PLACEHOLDER_IMAGE],
    vendor: VENDOR_ID,
    isActive: true,
  }
];

const seedDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error("MONGO_URI not found in .env file");
    }
    await connectDatabase(mongoURI);
    console.log('Database connected for seeding...');

    const vendor = await User.findById(VENDOR_ID);
    if (!vendor) {
      throw new Error(`Vendor with ID "${VENDOR_ID}" not found.`);
    }
    if (vendor.role !== 'vendor') {
      throw new Error(`User with ID "${VENDOR_ID}" is not a vendor.`);
    }

    // Clear existing products for this vendor to avoid duplicates
    const { deletedCount } = await Product.deleteMany({ vendor: VENDOR_ID });
    console.log(`Cleared ${deletedCount} old products for vendor ${vendor.name}.`);

    await Product.insertMany(sampleProducts);
    console.log(`${sampleProducts.length} products have been successfully created for vendor ${vendor.name}!`);

  } catch (error) {
    console.error('Error seeding the database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
};

seedDB();