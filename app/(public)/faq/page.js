import Link from "next/link";
import { HelpCircle } from "lucide-react";

export const metadata = {
  title: "FAQ | Kufuor Scholars Program",
  description:
    "Frequently asked questions about the Kufuor Scholars Program, eligibility, application process, and more.",
};

const faqs = [
  {
    category: "About the Program",
    questions: [
      {
        q: "What is the Kufuor Scholars Program?",
        a: "The Kufuor Scholars Program is a 3-year leadership development initiative of the John A. Kufuor Foundation. It is open to all Africans studying in Ghana and nurtures exceptional scholars through mentorship, training, community impact projects, and access to a powerful network of leaders.",
      },
      {
        q: "How long does the program last?",
        a: "The program runs for 3 years. Scholars progress through foundation (Year 1), deepening (Year 2), and graduation (Year 3) phases, with ongoing engagement as alumni.",
      },
      {
        q: "Is the program full-time or part-time?",
        a: "The program is designed to run alongside your studies or career. Scholars participate in workshops, mentorship sessions, and community projects while continuing their academic or professional pursuits.",
      },
    ],
  },
  {
    category: "Eligibility & Application",
    questions: [
      {
        q: "Who can apply?",
        a: "African nationals (not limited to Ghanaian citizens), aged 25 or under, who are currently enrolled in a tertiary institution in Ghana. Applicants must demonstrate leadership potential, community involvement, and a strong academic record.",
      },
      {
        q: "When do applications open?",
        a: "Application periods are announced on our website and social media. Sign up for updates or check the Apply page for the current status and deadline.",
      },
      {
        q: "What documents do I need to apply?",
        a: "You will need to create an account and complete the online application form. Required information typically includes your academic background, leadership experience, community involvement, and personal statement.",
      },
      {
        q: "Is there an application fee?",
        a: "No. The Kufuor Scholars Program does not charge an application fee.",
      },
    ],
  },
  {
    category: "Selection & Benefits",
    questions: [
      {
        q: "How are scholars selected?",
        a: "Applications are reviewed by our selection committee. Shortlisted candidates are invited for interviews. Final selection is based on leadership potential, character, academic merit, and alignment with our core values.",
      },
      {
        q: "What benefits do scholars receive?",
        a: "Scholars receive leadership training, one-on-one mentorship from accomplished professionals, stipends to support participation, access to a pan-African network, and hands-on community impact opportunities.",
      },
      {
        q: "Do I need to be in Accra to participate?",
        a: "The program includes both in-person and virtual components. Scholars at institutions across Ghana are welcome regardless of nationality. Travel support may be provided for key events when possible.",
      },
    ],
  },
  {
    category: "After the Program",
    questions: [
      {
        q: "What happens after I graduate?",
        a: "Graduates become part of the Kufuor Scholars alumni network. Alumni continue to benefit from networking opportunities, mentorship, and engagement with new cohorts.",
      },
      {
        q: "Can I contact current scholars or alumni?",
        a: "You can explore our Scholars directory to learn about current scholars and their work. For specific inquiries, reach out through our Contact section.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="pt-24">
      {/* Hero */}
      <div className="bg-royal">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-gold"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            Find answers to common questions about the Kufuor Scholars Program.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        {faqs.map((section) => (
          <section key={section.category} className="mb-16">
            <h2 className="mb-6 text-xl font-bold text-royal">
              {section.category}
            </h2>
            <div className="space-y-6">
              {section.questions.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                  <h3 className="flex items-start gap-2 font-semibold text-gray-900">
                    <HelpCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold" />
                    {faq.q}
                  </h3>
                  <p className="mt-3 text-gray-600">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-2xl bg-royal/5 p-8 text-center">
          <p className="text-gray-700">
            Still have questions?{" "}
            <Link href="/#contact" className="font-semibold text-royal hover:text-gold">
              Get in touch
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
