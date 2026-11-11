import Hero from "@/components/home/Hero";
import { Marquee, Problem } from "@/components/home/Sections1";
import ScrollStory from "@/components/home/ScrollStory";
import { Simulator, AuditConsole } from "@/components/home/Sections2";
import { Features, SizingPreview } from "@/components/home/Sections3";
import { Trust, Team, Faq, FinalCta } from "@/components/home/Sections4";

export default function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <Problem />
      <ScrollStory />
      <Simulator />
      <AuditConsole />
      <Features />
      <SizingPreview />
      <Trust />
      <Team />
      <Faq />
      <FinalCta />
    </>
  );
}
