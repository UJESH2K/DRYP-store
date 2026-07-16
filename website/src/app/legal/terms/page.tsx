export const metadata = {
  title: "Terms of Service — DRYP",
  description: "DRYP Terms of Service — rules for using the DRYP platform.",
};

const sections = [
  {
    id: "eligibility",
    title: "1. Eligibility",
  },
  {
    id: "account-responsibilities",
    title: "2. Account Responsibilities",
  },
  {
    id: "acceptable-use",
    title: "3. Acceptable Use",
  },
  {
    id: "intellectual-property",
    title: "4. Intellectual Property",
  },
  {
    id: "limitation-of-liability",
    title: "5. Limitation of Liability",
  },
  {
    id: "governing-law",
    title: "6. Governing Law",
  },
  {
    id: "termination",
    title: "7. Termination",
  },
  {
    id: "contact",
    title: "8. Contact",
  },
];

import Link from "next/link";

const TermsPage = () => {
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
              Terms of Service
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

          {/* Section 1: Eligibility */}
          <section id="eligibility" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Eligibility
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                By accessing or using the DRYP platform (the &quot;Platform&quot;),
                including the mobile application and vendor studio website, you
                agree to be bound by these Terms of Service (&quot;Terms&quot;). If
                you do not agree to these Terms, you may not use the Platform.
              </p>
              <p>
                You must be at least <strong>13 years of age</strong> to create an
                account or use any part of the Platform. If you are between 13 and
                18, you represent that your legal guardian has reviewed and agrees to
                these Terms on your behalf.
              </p>
              <p>
                By using the Platform, you represent and warrant that you meet all
                eligibility requirements and will comply with these Terms.
              </p>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 2: Account Responsibilities */}
          <section id="account-responsibilities" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Account Responsibilities
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>You are responsible for maintaining the confidentiality of your account and for all activity that occurs under it. Specifically:</p>
              <ul className="space-y-3 pl-0">
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>
                    You must provide accurate, current, and complete information when
                    creating an account and keep your account details up to date.
                  </span>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>
                    You are responsible for safeguarding your password. DRYP will
                    never ask for your password. If you suspect unauthorised access,
                    notify us immediately at{" "}
                    <a
                      href="mailto:support@dryp.store"
                      className="underline underline-offset-4 hover:text-black"
                    >
                      support@dryp.store
                    </a>
                    .
                  </span>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>
                    You agree not to impersonate any person or entity or falsely
                    state or misrepresent your affiliation with any person or entity.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 3: Acceptable Use */}
          <section id="acceptable-use" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Acceptable Use
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                You agree to use the Platform lawfully and in accordance with these
                Terms. The following uses are strictly prohibited:
              </p>
              <div className="space-y-4 mt-6">
                <div className="border-l border-gray-300 pl-5 py-1">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                    Illegal Content
                  </h3>
                  <p>
                    You may not upload, post, or transmit any content that is
                    unlawful, harmful, threatening, abusive, defamatory, obscene, or
                    otherwise objectionable.
                  </p>
                </div>
                <div className="border-l border-gray-300 pl-5 py-1">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                    Harassment
                  </h3>
                  <p>
                    You may not harass, bully, intimidate, or threaten any other user
                    or vendor on the Platform, whether through messages, reviews, or
                    any other form of communication.
                  </p>
                </div>
                <div className="border-l border-gray-300 pl-5 py-1">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                    Scraping and Automated Access
                  </h3>
                  <p>
                    You may not use any robot, spider, scraper, data mining tool,
                    data gathering or extraction tool, or other automated means to
                    access the Platform for any purpose without our express written
                    permission.
                  </p>
                </div>
                <div className="border-l border-gray-300 pl-5 py-1">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-black font-normal mb-2">
                    Security Violations
                  </h3>
                  <p>
                    You may not attempt to probe, scan, or test the vulnerability of
                    any system or network connected to the Platform, or breach or
                    circumvent any security or authentication measures.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 4: Intellectual Property */}
          <section id="intellectual-property" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Intellectual Property
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                The DRYP platform, including its name, logo, design, code, and all
                underlying technology, is owned by DRYP and protected by applicable
                intellectual property laws. You may not copy, modify, distribute, or
                create derivative works from any part of the Platform without our
                prior written consent.
              </p>
              <p>
                Vendors retain ownership of the content they publish on the Platform,
                including product listings, images, descriptions, and brand
                information. By publishing content, vendors grant DRYP a worldwide,
                non-exclusive, royalty-free license to host, display, and distribute
                that content solely for the purpose of operating the Platform.
              </p>
              <p>
                User-generated content (including profile information, reviews, and
                uploaded images) remains your property. By posting content, you grant
                DRYP a license to use it for the operation and improvement of the
                Platform.
              </p>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 5: Limitation of Liability */}
          <section id="limitation-of-liability" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Limitation of Liability
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                To the maximum extent permitted by law, DRYP and its directors,
                officers, employees, agents, and affiliates shall not be liable for
                any indirect, incidental, special, consequential, or punitive
                damages, including loss of profits, data, goodwill, or other
                intangible losses, resulting from:
              </p>
              <ul className="space-y-3 pl-0">
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>Your use or inability to use the Platform;</span>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>
                    Any unauthorised access to or use of our servers or personal
                    information;
                  </span>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>
                    Any interruption or cessation of transmission to or from the
                    Platform;
                  </span>
                </li>
                <li className="flex gap-4">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-black flex-shrink-0" />
                  <span>
                    Any bugs, viruses, or similar code transmitted through the
                    Platform.
                  </span>
                </li>
              </ul>
              <p className="mt-4">
                In no event shall DRYP&apos;s total liability to you exceed the
                amount you paid to DRYP in the twelve (12) months preceding the
                claim.
              </p>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 6: Governing Law */}
          <section id="governing-law" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Governing Law
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                These Terms shall be governed by and construed in accordance with
                the laws of <strong>New South Wales, Australia</strong>, without
                regard to its conflict of law provisions.
              </p>
              <p>
                You agree to submit to the exclusive jurisdiction of the courts
                located in New South Wales, Australia for the resolution of any
                disputes arising out of or relating to these Terms or your use of
                the Platform.
              </p>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 7: Termination */}
          <section id="termination" className="mb-16 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Termination
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                Either party may terminate your access to the Platform at any time,
                for any reason, with or without notice.
              </p>
              <p>
                You may terminate your account at any time by contacting{" "}
                <a
                  href="mailto:support@dryp.store"
                  className="underline underline-offset-4 hover:text-black"
                >
                  support@dryp.store
                </a>
                . Upon termination, your right to use the Platform will immediately
                cease.
              </p>
              <p>
                DRYP reserves the right to suspend or terminate your account if you
                violate these Terms, engage in fraudulent or illegal activity, or
                for any other reason deemed appropriate by DRYP.
              </p>
              <p>
                Upon termination, provisions of these Terms that by their nature
                should survive termination shall remain in effect, including without
                limitation, ownership provisions, warranty disclaimers, and
                limitations of liability.
              </p>
            </div>
          </section>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-16" />

          {/* Section 8: Contact */}
          <section id="contact" className="mb-20 scroll-mt-12">
            <h2 className="font-editorial text-2xl md:text-3xl font-normal tracking-tight text-black mb-6">
              Contact
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.8] text-gray-700 font-light">
              <p>
                If you have questions about these Terms of Service, please contact
                us:
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

export default TermsPage;
