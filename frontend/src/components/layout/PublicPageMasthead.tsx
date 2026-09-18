import type { ReactNode } from "react";

type PublicPageMastheadProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/** Shared public-route masthead: a single maroon field, gold rule, and clear page task. */
const PublicPageMasthead = ({ title, description, children }: PublicPageMastheadProps) => (
  <section className="relative overflow-hidden border-b border-warning/70 bg-primary text-primary-foreground">
    <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgb(0_0_0_/_0.16)_100%)]" />
    <div className="relative h-[2px] bg-warning" />
    <div className="container relative px-5 py-11 sm:px-8 sm:py-14 lg:px-12 xl:px-16">
      <p className="homepage-kicker flex items-center gap-3 text-warning"><span className="h-px w-8 bg-warning" />EUC Library</p>
      <h1 className="mt-5 text-4xl font-bold leading-[.92] tracking-[-.055em] sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-primary-foreground/78 sm:text-base">{description}</p>
      {children ? <div className="mt-7">{children}</div> : null}
    </div>
  </section>
);

export default PublicPageMasthead;
