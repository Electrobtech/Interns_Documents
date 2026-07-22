import Navbar from '@/components/marketing/Navbar';
import Hero from '@/components/marketing/Hero';
import TrustedLogos from '@/components/marketing/TrustedLogos';
import Pillars from '@/components/marketing/Pillars';
import FeatureGrid from '@/components/marketing/FeatureGrid';
import PlatformTabs from '@/components/marketing/PlatformTabs';
import HowItWorks from '@/components/marketing/HowItWorks';
import Channels from '@/components/marketing/Channels';
import Proof from '@/components/marketing/Proof';
import FAQ from '@/components/marketing/FAQ';
import FinalCTA from '@/components/marketing/FinalCTA';
import Footer from '@/components/marketing/Footer';

export default function LandingPage() {
  return (
    <div className="bg-white min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <TrustedLogos />
        <Pillars />
        <FeatureGrid />
        <PlatformTabs />
        <HowItWorks />
        <Channels />
        <Proof />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
