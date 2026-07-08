import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

function LegalShell({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-ayana-bg flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto px-5 sm:px-8 py-14 w-full">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ayana-text">{title}</h1>
        <p className="mt-2 text-sm text-ayana-muted">Last updated: {updated}</p>
        <div className="mt-8 space-y-6 text-ayana-secondary leading-relaxed">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

const H = ({ children }) => <h2 className="font-display text-xl font-medium text-ayana-text mt-8">{children}</h2>;

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy" updated="July 2026">
      <p>AYANA exists to help you stay close to your parents. We treat your family's data with the care it deserves. This policy explains what we collect and how we protect it.</p>
      <H>What we collect</H>
      <p>Your account details (name, email, phone), your parent's profile (name, relationship, WhatsApp number, preferred language, timezone), the care schedule you create, consent records, and delivery logs of messages sent.</p>
      <H>How we use it</H>
      <p>Solely to deliver the scheduled care check-ins you configure. We never sell your data or use it for advertising.</p>
      <H>Consent</H>
      <p>We record explicit consent for both your setup and your parent's participation. You confirm your parent is aware of and welcomes these messages.</p>
      <H>Security</H>
      <p>Secrets are stored server-side only. Passwords are hashed. Access to your data is protected by secure authentication. WhatsApp webhooks are signature-verified.</p>
      <H>Your rights</H>
      <p>You can edit or delete any profile or schedule at any time. You can permanently delete your account and associated data from your dashboard.</p>
      <H>Voice notes</H>
      <p>Voice replies from your parent are preserved in their original form and are not translated or altered.</p>
    </LegalShell>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms of Use" updated="July 2026">
      <p>By using AYANA you agree to these terms. Please read them with care.</p>
      <H>The service</H>
      <p>AYANA is a care companion that sends scheduled, warm WhatsApp messages to your parent in their chosen language. It supports your care — it does not replace it.</p>
      <H>Your responsibilities</H>
      <p>You confirm you have your parent's consent to receive messages, and that the contact details you provide are accurate and yours to share.</p>
      <H>Not an emergency service</H>
      <p>AYANA is not a medical, health, or emergency service. It may detect and flag urgent keywords, but you must not rely on it for emergencies. In a crisis, contact local emergency services immediately.</p>
      <H>Payments</H>
      <p>During the current testing phase, payments are disabled and access is provided on a free trial basis.</p>
      <H>Acceptable use</H>
      <p>You agree not to use AYANA to send unwanted, harmful, or unlawful messages to anyone.</p>
    </LegalShell>
  );
}

export function Disclaimer() {
  return (
    <LegalShell title="Care Disclaimer" updated="July 2026">
      <p className="text-ayana-text font-medium">AYANA is a companion for connection, not a substitute for care, medical advice, or emergency response.</p>
      <H>Not medical advice</H>
      <p>Messages sent through AYANA are for emotional connection and gentle reminders only. They are not medical guidance and should not be treated as such.</p>
      <H>Emergency limitations</H>
      <p>AYANA can detect certain urgent keywords in replies and surface them to you, but it cannot guarantee detection and does not contact emergency services. If you or your parent face a medical or safety emergency, call local emergency services right away.</p>
      <H>Human care first</H>
      <p>Nothing here replaces your love, calls, and visits. AYANA simply helps carry a little warmth to your parents on the days in between.</p>
    </LegalShell>
  );
}
