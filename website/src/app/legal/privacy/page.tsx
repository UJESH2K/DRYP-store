export const metadata = {
  title: "Privacy Policy — DRYP",
  description: "DRYP Privacy Policy — how we collect, use, and protect your data.",
};

const sections = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
  },
  {
    id: "how-we-use-your-data",
    title: "2. How We Use Your Data",
  },
  {
    id: "third-party-services",
    title: "3. Third-Party Services",
  },
  {
    id: "data-retention",
    title: "4. Data Retention",
  },
  {
    id: "your-rights",
    title: "5. Your Rights",
  },
  {
    id: "contact",
    title: "6. Contact",
  },
];

import Link from "next/link";

const PrivacyPage = () => {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .font-editorial { font-family: 'Playfair Display', serif; }
      `,
        }}
      />

      <div className="min-h-screen bg-[#FCFCFA] text-black font-sans antialiased">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 md:px-16 py-16 md:py-24">
          {/* Header */}
          <header className="mb-16">
            <h1 className="font-editorial text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-black leading-[1.1]">
              Privacy Policy
            </h1>
            <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-gray-400 mt-6">
              Last Updated — July 2026
            </p>
          </header>

          {/* Navigation */}
          <nav className="mb-20 border-b border-gray-200 pb-10">
            <p className="font-sans text-[9px] uppercase tracking-[0.2em] text-gray-400 mb-5">
              Jump to
            </p>
            <ul className="space-y-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-[13px] tracking-wide text-gray-600 hover:text-black transition-colors"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Section 1: Information We Collect */}
          <section id="information-we-collect" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Information We Collect
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                DRYP collects information you provide directly to us and data generated
                through your use of the platform. This includes:
              </p>

              <div className="border-l border-black pl-5 py-1">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                  Personal Information
                </h3>
                <p>
                  When you register or interact with the platform, we collect your name,
                  email address, and profile information you choose to provide.
                </p>
              </div>

              <div className="border-l border-black pl-5 py-1">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                  Purchase History
                </h3>
                <p>
                  We maintain records of your orders, including products purchased,
                  transaction dates, shipping addresses, and payment status.
                </p>
              </div>

              <div className="border-l border-black pl-5 py-1">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                  Product Interactions
                </h3>
                <p>
                  We track how you interact with products on the platform, including
                  items you like, swipe on, add to your cart, and purchase. This data
                  powers our AI stylist recommendations and personalisation engine.
                </p>
              </div>

              <div className="border-l border-black pl-5 py-1">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                  Photos and Media
                </h3>
                <p>
                  If you use our image picker or upload features (for example, to share
                  outfit photos with the AI stylist), the images you upload are
                  temporarily processed for the session and are not stored permanently
                  unless explicitly saved to your account.
                </p>
              </div>

              <div className="border-l border-black pl-5 py-1">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                  Device Identifiers and IP Address
                </h3>
                <p>
                  We collect device identifiers, IP addresses, and browser type to
                  ensure platform security, detect fraud, and analyse usage patterns.
                  This data is used in aggregate and is not linked to your personal
                  identity without consent.
                </p>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 2: How We Use Your Data */}
          <section id="how-we-use-your-data" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              How We Use Your Data
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                We use the information we collect to operate, improve, and personalise
                the DRYP platform:
              </p>

              <ul className="space-y-4 pl-0">
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <div>
                    <span className="text-black text-[13px] tracking-wide">
                      Personalisation and Recommendations
                    </span>
                    <p className="mt-1">
                      Your product interactions (likes, swipes, cart activity,
                      purchases) feed into our on-device recommendation engine and AI
                      stylist to surface products and brands relevant to your taste.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <div>
                    <span className="text-black text-[13px] tracking-wide">
                      Order Processing and Fulfilment
                    </span>
                    <p className="mt-1">
                      Purchase data is used to process orders, coordinate with vendors
                      for fulfilment, and provide you with shipping updates and
                      receipts.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <div>
                    <span className="text-black text-[13px] tracking-wide">
                      Customer Support
                    </span>
                    <p className="mt-1">
                      We may use your account information and order history to
                      investigate issues, respond to enquiries, and provide support via
                      our team at{" "}
                      <a
                        href="mailto:support@dryp.store"
                        className="underline underline-offset-4 hover:text-black"
                      >
                        support@dryp.store
                      </a>
                      .
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <div>
                    <span className="text-black text-[13px] tracking-wide">
                      Analytics and Platform Improvement
                    </span>
                    <p className="mt-1">
                      We analyse usage data in aggregate to understand how the platform
                      is used, identify trends, and improve the experience for all
                      users.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 3: Third-Party Services */}
          <section id="third-party-services" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Third-Party Services
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                DRYP integrates with the following third-party services to deliver
                functionality. Each service has its own privacy policy governing how
                it handles your data:
              </p>

              <div className="space-y-5 mt-8">
                <div className="border border-gray-200 p-6">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                    OpenAI
                  </h3>
                  <p>
                    The AI Stylist feature sends your messages and product context to
                    OpenAI&apos;s API to generate personalised recommendations. OpenAI
                    does not use API inputs to train its models. Data is processed
                    according to OpenAI&apos;s privacy policy.
                  </p>
                </div>

                <div className="border border-gray-200 p-6">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                    Amazon Web Services (AWS S3)
                  </h3>
                  <p>
                    Product images are stored on Amazon S3. S3 stores data in the
                    AWS infrastructure and is governed by AWS&apos;s privacy and
                    security commitments. Image data is stored as private keys and
                    served via signed URLs.
                  </p>
                </div>

                <div className="border border-gray-200 p-6">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                    Stripe
                  </h3>
                  <p>
                    Payment processing will be handled by Stripe when checkout
                    functionality is released. Payment card details are never
                    transmitted through or stored on DRYP servers — they are
                    processed directly through Stripe&apos;s secure infrastructure.
                  </p>
                </div>

                <div className="border border-gray-200 p-6">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                    Expo
                  </h3>
                  <p>
                    The DRYP mobile application is built with Expo. Expo handles
                    app distribution, push notification infrastructure, and build
                    hosting. See Expo&apos;s privacy policy for details on how they
                    process developer and user data.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 4: Data Retention */}
          <section id="data-retention" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Data Retention
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                We retain your information for as long as your account is active or
                as needed to provide you services.
              </p>
              <ul className="space-y-3 list-none pl-0">
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>
                    Account data (profile, preferences, order history) is retained
                    until you request account deletion.
                  </span>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>
                    Session data and temporary processing artefacts are retained for
                    a maximum of 30 days.
                  </span>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>
                    Upon receiving a verified deletion request, we will remove your
                    personal data from active systems within 30 days, except where
                    retention is required by law.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 5: Your Rights */}
          <section id="your-rights" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Your Rights
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                You have the following rights regarding your personal data. To
                exercise any of these rights, contact us at{" "}
                <a
                  href="mailto:support@dryp.store"
                  className="underline underline-offset-4 hover:text-black"
                >
                  support@dryp.store
                </a>
                :
              </p>

              <div className="grid gap-4 mt-8 sm:grid-cols-2">
                {[
                  {
                    label: "Access",
                    text: "Request a copy of all personal data we hold about you.",
                  },
                  {
                    label: "Correction",
                    text: "Request correction of any inaccurate or incomplete data.",
                  },
                  {
                    label: "Deletion",
                    text: "Request deletion of your account and personal data.",
                  },
                  {
                    label: "Export",
                    text: "Request a machine-readable export of your data.",
                  },
                ].map((right) => (
                  <div
                    key={right.label}
                    className="border border-gray-200 p-5"
                  >
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                      {right.label}
                    </h3>
                    <p className="text-[13px] leading-relaxed">{right.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 6: Contact */}
          <section id="contact" className="mb-20 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Contact
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                If you have questions or concerns about this Privacy Policy, or wish
                to exercise any of your rights, please contact:
              </p>
              <p>
                <a
                  href="mailto:support@dryp.store"
                  className="text-black underline underline-offset-4 hover:text-gray-600 transition-colors"
                >
                  support@dryp.store
                </a>
              </p>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-gray-200 pt-10">
            <Link
              href="https://www.dryp.store"
              className="font-sans text-[10px] uppercase tracking-[0.3em] text-gray-400 hover:text-black transition-colors"
            >
              &larr; Return to dryp.store
            </Link>
          </footer>
        </div>
      </div>
    </>
  );
};

export default PrivacyPage;
