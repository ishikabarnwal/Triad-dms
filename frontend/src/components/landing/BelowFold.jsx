import { CallToAction, Faq, Numbers, Security } from "./Closing";
import Footer from "./Footer";
import { Bento, HowItWorks, Pipeline } from "./Sections";

/** Everything after the hero, loaded as its own chunk so the first screen paints sooner. */
export default function BelowFold() {
  return (
    <>
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
