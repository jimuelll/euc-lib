import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSubscriptions } from "./hooks";
import {
  PageHeader,
  CountBar,
  SubscriptionGrid,
  LoadingState,
  ErrorState,
  EmptyState,
  FooterNotice,
} from "./components";

const AcademicSubscriptions = () => {
  const { subscriptions, status, error } = useSubscriptions();

  const isLoading = status === "loading" || status === "idle";
  const isError   = status === "error";
  const isEmpty   = status === "success" && subscriptions.length === 0;
  const hasData   = status === "success" && subscriptions.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="py-16">
        <div className="container max-w-4xl px-4 sm:px-6">

          <PageHeader />
          <CountBar count={subscriptions.length} loading={isLoading} />

          {isLoading && <LoadingState />}
          {isError   && <ErrorState message={error!} />}
          {isEmpty   && <EmptyState />}
          {hasData   && <SubscriptionGrid subscriptions={subscriptions} />}

          {!isLoading && !isError && <FooterNotice />}

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AcademicSubscriptions;