import { CallToAction, Faq, Footer, Numbers, Security } from "./Closing";
import { Bento, HowItWorks, Marquee, Pipeline } from "./Sections";

/** Everything after the hero, loaded as its own chunk so the first screen paints sooner. */
export default function BelowFold() {
  return (
    <>
      <Marquee />
      <Bento />
      <Pipeline />
      <HowItWorks />
      <Security />
      <Numbers />
      <Faq />
      <CallToAction />
      <Footer />
    </>
  );
}
