/**
 * /terms — Terms of Service.
 *
 * The boilerplate below is a starting point. Before publishing,
 * have it reviewed by counsel. App Store does not strictly require
 * Terms of Service (only a Privacy Policy URL), but exposing them
 * protects the platform legally.
 */

export const metadata = {
  title: "Terms of Service — DRYP",
  description: "Terms and conditions for using DRYP.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FCFCFA] text-[#1a1a1a] px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-playfair mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">
          Last updated: 15 June 2026
        </p>

        <Section title="1. Acceptance">
          <p>
            By using DRYP, you agree to these terms. If you don't agree,
            please don't use the service.
          </p>
        </Section>

        <Section title="2. Account">
          <p>
            You're responsible for your account credentials. Don't share
            them. If you suspect unauthorised access, contact us
            immediately at{" "}
            <a
              href="mailto:support@dryp.com"
              className="underline text-[#1a1a1a]"
            >
              support@dryp.com
            </a>
            .
          </p>
        </Section>

        <Section title="3. Purchases">
          <p>
            Prices are shown at checkout and may change without notice.
            We reserve the right to refuse or cancel orders (e.g. for
            suspected fraud). Refunds follow the policy on each
            product's detail page.
          </p>
        </Section>

        <Section title="4. Vendors">
          <p>
            Vendors are responsible for accurate product descriptions,
            pricing, and shipping. DRYP takes a 10% platform fee on
            completed sales. Payouts are processed weekly.
          </p>
        </Section>

        <Section title="5. Content">
          <p>
            You retain ownership of content you upload (product photos,
            descriptions). You grant DRYP a worldwide, non-exclusive
            licence to display that content on the platform.
          </p>
        </Section>

        <Section title="6. Prohibited use">
          <p>
            You agree not to: (a) use the service for illegal
            purposes, (b) upload malicious content, (c) scrape or
            bulk-download the catalogue, (d) interfere with the
            service's operation.
          </p>
        </Section>

        <Section title="7. Termination">
          <p>
            We may suspend or terminate accounts that violate these
            terms. We'll notify you first when possible and give you
            a chance to fix the issue.
          </p>
        </Section>

        <Section title="8. Disclaimers">
          <p>
            DRYP is provided "as is" without warranties of any kind.
            We don't guarantee uninterrupted service. Our liability is
            limited to the amount you've paid us in the last 12 months.
          </p>
        </Section>

        <Section title="9. Governing law">
          <p>
            These terms are governed by the laws of the jurisdiction in
            which DRYP is incorporated. Disputes will be resolved in
            that jurisdiction's courts.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions:{" "}
            <a
              href="mailto:legal@dryp.com"
              className="underline text-[#1a1a1a]"
            >
              legal@dryp.com
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