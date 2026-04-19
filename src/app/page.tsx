import { HeroSection } from '@/components/landing/HeroSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { WhoWeAreSection } from '@/components/landing/WhoWeAreSection';
import { SocialProofSection } from '@/components/landing/SocialProofSection';
import { ProgramsSection } from '@/components/landing/ProgramsSection';
import { RegistrationCTASection } from '@/components/landing/RegistrationCTASection';

export default function Home() {
  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <section id="about">
        <WhoWeAreSection />
      </section>
      <SocialProofSection />
      <section id="programs">
        <ProgramsSection />
      </section>
      <RegistrationCTASection />
    </main>
  );
}
