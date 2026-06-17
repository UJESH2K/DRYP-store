/**
 * jobs/index.js — registers all background workers at boot.
 *
 * Call registerAll() once from server.js AFTER the database is
 * connected (so handlers can use Mongoose). Each worker delegates
 * to existing business logic — this file is just a wiring layer.
 *
 * Why centralize the registration:
 *  - One place to see what runs in the background.
 *  - Easy to add metrics / logging around every job.
 *  - Easy to disable a worker by commenting a line.
 */

const queue = require('../utils/jobQueue');
const sendEmail = require('../utils/sendEmail');

function registerAll() {
  // Phase 0E: vendor approval email. Currently a no-op alias for
  // the existing sendEmail() call — extracted so the route can
  // call enqueue() and not block the admin request.
  queue.register('sendVendorApprovalEmail', async (data) => {
    const { email, status, frontendUrl } = data;
    if (status === 'approved') {
      await sendEmail({
        email,
        subject: 'DRYP: Studio Approved',
        message: `Your application has been accepted. You may now create your account at: ${frontendUrl}/signup`,
      });
    } else {
      await sendEmail({
        email,
        subject: 'DRYP: Application Status',
        message:
          'Thank you for your interest in DRYP. Unfortunately, your studio does not align with our current curation. We wish you the best.',
      });
    }
    return { sent: true };
  });

  // Phase 0E: password reset email — same idea, fire-and-forget
  // background send.
  queue.register('sendPasswordResetEmail', async (data) => {
    await sendEmail({
      email: data.email,
      subject: data.subject,
      message: data.message,
      html: data.html,
    });
    return { sent: true };
  });

  // Phase 3D hook: stock sync worker. When a vendor has a Shopify
  // connection, the route enqueues this job; it walks the product
  // map and pushes current DB stock to Shopify. The actual
  // implementation lives in the route — this is a no-op stub so
  // the job name is registered before a vendor first syncs.
  queue.register('shopifyStockSync', async (data) => {
    // The actual push is done inline by routes/vendors.js#syncStock
    // which knows about the connection object. This worker is the
    // background runner when the route is in "enqueue mode".
    return { vendorId: data.vendorId, note: 'use route implementation' };
  });
}

module.exports = { registerAll };