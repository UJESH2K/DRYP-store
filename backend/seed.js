require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product'); // Adjust this path if your models folder is elsewhere

// The User ID of the vendor (extracted from the 'owner' field you provided)
const VENDOR_USER_ID = "69d511c49d3f5ecfb115378a"; 

const seedProducts = [
  {
    name: "Asymmetric Wool Overcoat",
    description: "Heavyweight Italian wool overcoat featuring an aggressive asymmetric drape and dropped shoulders. Fully lined with cupro. A brutalist approach to winter tailoring.",
    brand: "Darinda",
    category: "Outerwear",
    tags: ["AW26", "Wool", "Tailoring", "Avant-Garde"],
    basePrice: 850,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Obsidian", "Charcoal"] },
      { name: "Size", values: ["46", "48", "50"] }
    ],
    variants: [
      { options: { Color: "Obsidian", Size: "46" }, stock: 3, price: 850, images: ["https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?q=80&w=1000&auto=format&fit=crop"] },
      { options: { Color: "Obsidian", Size: "48" }, stock: 5, price: 850, images: ["https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?q=80&w=1000&auto=format&fit=crop"] },
      { options: { Color: "Charcoal", Size: "50" }, stock: 2, price: 850, images: ["https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?q=80&w=1000&auto=format&fit=crop"] }
    ]
  },
  {
    name: "Pleated Wide-Leg Trousers",
    description: "Flowing wide-leg trousers cut from Japanese gabardine. Features deep double pleats and an extended waistband for a fluid, structural silhouette.",
    brand: "Darinda",
    category: "Bottoms",
    tags: ["Trousers", "Tailored", "Flow"],
    basePrice: 320,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Void Black"] },
      { name: "Size", values: ["S", "M", "L"] }
    ],
    variants: [
      { options: { Color: "Void Black", Size: "S" }, stock: 12, price: 320, images: [] },
      { options: { Color: "Void Black", Size: "M" }, stock: 18, price: 320, images: [] },
      { options: { Color: "Void Black", Size: "L" }, stock: 8, price: 320, images: [] }
    ]
  },
  {
    name: "Deconstructed Silk Shirt",
    description: "A reimagined button-down crafted from raw silk. Features raw hems, elongated sleeves, and a displaced collar block. Deliberately imperfect.",
    brand: "Darinda",
    category: "Tops",
    tags: ["Silk", "Deconstructed", "SS26"],
    basePrice: 280,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1626497761153-d1e870c514fa?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Bone", "Ash"] },
      { name: "Size", values: ["M", "L"] }
    ],
    variants: [
      { options: { Color: "Bone", Size: "M" }, stock: 6, price: 280, images: [] },
      { options: { Color: "Ash", Size: "L" }, stock: 4, price: 280, images: [] }
    ]
  },
  {
    name: "Heavyweight Boxy Hoodie",
    description: "600gsm loopback french terry hoodie. Extremely cropped body with severely dropped, elongated sleeves. Features hidden side-seam pockets.",
    brand: "Darinda",
    category: "Sweatshirts",
    tags: ["Streetwear", "Heavyweight", "Cropped"],
    basePrice: 190,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Concrete"] },
      { name: "Size", values: ["S", "M", "L", "XL"] }
    ],
    variants: [
      { options: { Color: "Concrete", Size: "M" }, stock: 20, price: 190, images: [] },
      { options: { Color: "Concrete", Size: "L" }, stock: 25, price: 190, images: [] }
    ]
  },
  {
    name: "Artisan Leather Derbies",
    description: "Chunky, brutalist derby shoes handcrafted from vegetable-tanned calf leather. Goodyear welted on an exaggerated Vibram lug sole.",
    brand: "Darinda",
    category: "Footwear",
    tags: ["Leather", "Footwear", "Chunky"],
    basePrice: 550,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Matte Black"] },
      { name: "Size", values: ["41", "42", "43", "44"] }
    ],
    variants: [
      { options: { Color: "Matte Black", Size: "42" }, stock: 5, price: 550, images: [] },
      { options: { Color: "Matte Black", Size: "43" }, stock: 7, price: 550, images: [] }
    ]
  },
  {
    name: "Distressed Overdyed Denim",
    description: "Vintage-washed denim with a heavy black over-dye. Features aggressive distressing at the knees and hems, stacked profile.",
    brand: "Darinda",
    category: "Bottoms",
    tags: ["Denim", "Distressed", "Grunge"],
    basePrice: 240,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Overdyed Black"] },
      { name: "Size", values: ["28", "30", "32", "34"] }
    ],
    variants: [
      { options: { Color: "Overdyed Black", Size: "30" }, stock: 15, price: 240, images: [] },
      { options: { Color: "Overdyed Black", Size: "32" }, stock: 22, price: 240, images: [] }
    ]
  },
  {
    name: "Structured Minimalist Blazer",
    description: "A razor-sharp tailored blazer absent of lapels. Hidden hook-and-eye closure. Designed to be worn as a brutalist shell over bare skin or fine knitwear.",
    brand: "Darinda",
    category: "Outerwear",
    tags: ["Tailored", "Minimalist", "Suiting"],
    basePrice: 620,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Chalk", "Onyx"] },
      { name: "Size", values: ["48", "50"] }
    ],
    variants: [
      { options: { Color: "Chalk", Size: "48" }, stock: 4, price: 620, images: [] },
      { options: { Color: "Onyx", Size: "50" }, stock: 6, price: 620, images: [] }
    ]
  },
  {
    name: "Technical Flared Cargo",
    description: "Water-repellent nylon cargos featuring a flared hem with adjustable bungee cords. Equipped with 3D articulated pockets and magnetic closures.",
    brand: "Darinda",
    category: "Bottoms",
    tags: ["Techwear", "Cargo", "Nylon"],
    basePrice: 290,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Olive Drab", "Pitch"] },
      { name: "Size", values: ["S", "M", "L"] }
    ],
    variants: [
      { options: { Color: "Pitch", Size: "M" }, stock: 14, price: 290, images: [] },
      { options: { Color: "Olive Drab", Size: "M" }, stock: 9, price: 290, images: [] }
    ]
  },
  {
    name: "Destroyed Mohair Knit",
    description: "Open-gauge mohair blend sweater featuring dropped stitches and controlled laddering. A delicate piece of wearable decay.",
    brand: "Darinda",
    category: "Knitwear",
    tags: ["Mohair", "Knit", "Grunge"],
    basePrice: 380,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1614975059251-992f11792b9f?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Crimson/Black"] },
      { name: "Size", values: ["One Size"] }
    ],
    variants: [
      { options: { Color: "Crimson/Black", Size: "One Size" }, stock: 8, price: 380, images: [] }
    ]
  },
  {
    name: "Geometric Crossbody Harness",
    description: "A leather harness/bag hybrid. Features severe geometric lines, matte black hardware, and enough space for absolute essentials. Worn tight to the chest.",
    brand: "Darinda",
    category: "Accessories",
    tags: ["Leather", "Bag", "Hardware"],
    basePrice: 410,
    vendor: VENDOR_USER_ID,
    images: ["https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=1000&auto=format&fit=crop"],
    options: [
      { name: "Color", values: ["Matte Black"] },
      { name: "Size", values: ["OS"] }
    ],
    variants: [
      { options: { Color: "Matte Black", Size: "OS" }, stock: 15, price: 410, images: [] }
    ]
  }
];

const runSeed = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }

    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected Successfully.\n");

    console.log(`Clearing old products for Vendor ${VENDOR_USER_ID}...`);
    const deleteResult = await Product.deleteMany({ vendor: VENDOR_USER_ID });
    console.log(`🗑️ Cleared ${deleteResult.deletedCount} old items.\n`);

    console.log("Seeding new dossier into the archive...");
    const insertedProducts = await Product.insertMany(seedProducts);
    
    console.log(`✅ Successfully curated ${insertedProducts.length} new items into Darinda's Studio!`);
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding Failed:");
    console.error(error);
    process.exit(1);
  }
};

runSeed();