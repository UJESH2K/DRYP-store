require('dotenv').config();
const mongoose = require('mongoose');
const VendorApplication = require('./src/models/VendorApplication');

const VERIFIED_FIELDS = ['verifiedGoogleEmail', 'verifiedGoogleId'];
const EMAIL_FIELDS = ['email', 'googleEmail', 'verifiedGoogleEmail'];

async function findDuplicateValues(field) {
  return VendorApplication.aggregate([
    { $match: { [field]: { $type: 'string', $ne: '' } } },
    { $group: { _id: `$${field}`, applicationIds: { $addToSet: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
}

async function findCrossFieldEmailCollisions() {
  const applications = await VendorApplication.find()
    .select(EMAIL_FIELDS.join(' '))
    .lean();
  const ownersByEmail = new Map();

  for (const application of applications) {
    for (const field of EMAIL_FIELDS) {
      const value = String(application[field] || '').toLowerCase().trim();
      if (!value) continue;
      const owners = ownersByEmail.get(value) || new Set();
      owners.add(String(application._id));
      ownersByEmail.set(value, owners);
    }
  }

  return [...ownersByEmail.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([value, owners]) => ({ value, applicationIds: [...owners] }));
}

function maskIdentity(value) {
  const at = value.indexOf('@');
  if (at < 0) return `${value.slice(0, 4)}…`;
  return `${value.slice(0, 2)}…${value.slice(at)}`;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);

  let collisionCount = 0;
  for (const field of VERIFIED_FIELDS) {
    const duplicates = await findDuplicateValues(field);
    collisionCount += duplicates.length;
    console.log(`${field}: ${duplicates.length} duplicate value(s)`);
    for (const duplicate of duplicates) {
      console.log(`  ${maskIdentity(String(duplicate._id))}: ${duplicate.applicationIds.join(', ')}`);
    }
  }

  const crossFieldCollisions = await findCrossFieldEmailCollisions();
  collisionCount += crossFieldCollisions.length;
  console.log(`cross-field email identities: ${crossFieldCollisions.length} collision(s)`);
  for (const collision of crossFieldCollisions) {
    console.log(`  ${maskIdentity(collision.value)}: ${collision.applicationIds.join(', ')}`);
  }

  if (collisionCount > 0) {
    process.exitCode = 2;
    console.error('Resolve collisions before deploying the verified Google identity indexes.');
  } else {
    console.log('Identity audit passed. Verified Google identity indexes are safe to create.');
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
