/**
 * /privacy — Privacy Policy (App Store & GDPR required).
 *
 * This is the privacy policy the App Store privacy questions link to
 * (App Store Connect → App Privacy → Privacy Policy URL) and that
 * GDPR / CCPA requires for any data collection. The text below is a
 * starting point — replace with a final reviewed version before
 * public App Store submission. The rough structure:
 *
 *  1. What we collect
 *  2. How we use it
 *  3. Where it lives (AWS, region)
 *  4. Who we share with (no one, except Shopify for vendor stores)
 *  5. Your rights (access, deletion, export)
 *  6. Contact
 *
 * If you add a data category in the code (e.g. location, contacts),
 * update section 1 below and the App Store privacy answers.
 */

export const metadata = {
  title: "Privacy Policy — DRYP",
  description:
    "How DRYP collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FCFCFA] text-[#1a1a1a] px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-playfair mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">
          Last updated: 15 June 2026
        </p>

        <Section title="1. What we collect">
          <p>
            We collect only what we need to run DRYP — a fashion
            e-commerce platform connecting shoppers with independent
            studios. Specifically:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>
              <strong>Account</strong>: your name, email address, and
              password (hashed). If you sign in with Google, we receive
              the email and name from your Google profile — we never see
              your Google password.
            </li>
            <li>
              <strong>Orders</strong>: shipping address and order
              history. Payment details are tokenised by our payment
              processor; we never store full card numbers.
            </li>
            <li>
              <strong>Activity</strong>: products you view, like, or add
              to cart. This powers the home feed ranking.
            </li>
            <li>
              <strong>Device</strong>: a session token stored in
              cookies (website) or AsyncStorage (mobile). Used to keep
              you signed in.
            </li>
            <li>
              <strong>Vendors only</strong>: photos you upload for
              product listings. These are stored on AWS S3.
            </li>
          </ul>
        </Section>

        <Section title="2. How we use it">
          <ul className="list-disc pl-6 space-y-1">
            <li>To process and ship your orders.</li>
            <li>To recommend products you'll like.</li>
            <li>
              To send transactional emails (order receipts, password
              resets, vendor approval). We don't send marketing email
              unless you opt in.
            </li>
            <li>
              To detect and prevent abuse (rate limiting, fraud).
            </li>
          </ul>
        </Section>

        <Section title="3. Where it lives">
          <p>
            Application data is stored on MongoDB Atlas. Images on AWS
            S3. Both are hosted in AWS regions (us-east-1 by default).
            We use Resend for transactional email and never share your
            address with marketing third parties.
          </p>
        </Section>

        <Section title="4. Who we share with">
          <p>We do not sell your data. We share it only with:</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>
              <strong>Payment processors</strong> — to charge you.
            </li>
            <li>
              <strong>Shipping carriers</strong> — to deliver your
              order.
            </li>
            <li>
              <strong>Shopify</strong> — only for vendors who connect a
              Shopify store, and only to sync stock/orders.
            </li>
            <li>
              <strong>Law enforcement</strong> — only when legally
              required.
            </li>
          </ul>
        </Section>

        <Section title="5. Your rights">
          <p>
            You can request a copy of your data, correct it, or delete
            it at any time. Email{" "}
            <a
              href="mailto:privacy@dryp.com"
              className="underline text-[#1a1a1a]"
            >
              privacy@dryp.com
            </a>{" "}
            and we'll action it within 30 days. Deletion is permanent
            and includes orders (which we may be required to retain for
            tax / legal reasons — we'll explain when that applies).
          </p>
        </Section>

        <Section title="6. Contact">
          <p>
            Questions:{" "}
            <a
              href="mailto:privacy@dryp.com"
              className="underline text-[#1a1a1a]"
            >
              privacy@dryp.com
            </a>
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-playfair mb-3">{title}</h2>
      <div className="leading-relaxed text-[15px] text-gray-800">
        {children}
      </div>
    </section>
  );
}