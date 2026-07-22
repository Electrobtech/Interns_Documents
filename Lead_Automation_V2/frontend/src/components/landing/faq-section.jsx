import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What happens when the AI gets it wrong?",
    a: "Every agent runs inside boundaries you set. When a question falls outside them — or confidence drops — it escalates to a human with the full thread attached. Every decision is logged, and corrections are made by fixing the source document, so the same mistake doesn't happen twice.",
  },
  {
    q: "Can we keep our existing WhatsApp number?",
    a: "Yes. We migrate your number to the official WhatsApp Business API. You keep the same number, and your message history is preserved through the transition.",
  },
  {
    q: "How long until it's live?",
    a: "You'll see it answering real messages the same afternoon. A full rollout with CRM sync and workflows typically takes about two weeks.",
  },
  {
    q: "Where does our data sit, and does it train anything?",
    a: "Data is resident in ap-south-1, and on enterprise plans it runs in your own VPC. Your conversations are never used to train models. We're SOC 2 Type II and ISO 27001 certified.",
  },
  {
    q: "We already have Salesforce. Does this replace it?",
    a: "No — it sits as a conversation layer on top of Salesforce with two-way sync. Records stay current in both systems without anyone maintaining them by hand.",
  },
  {
    q: "What does it cost?",
    a: "Pricing is based on conversations resolved, not seats. We quote you after running on a week of your real traffic, so the number reflects your actual volume.",
  },
];

export function FaqSection() {
  return (
    <section className="relative border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-12">
        <h2 className="text-balance text-center text-3xl font-semibold tracking-tight lg:text-4xl">
          Before you ask
        </h2>

        <Accordion type="single" collapsible className="mt-12 w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
