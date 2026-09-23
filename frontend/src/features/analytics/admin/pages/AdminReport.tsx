import { useAdminUrlState } from "@/features/admin";
import { AdminPage } from "@/features/admin";
import QueryExplorer from "@/features/query/QueryExplorer";
import ReportWorkspace from "@/features/query/ReportWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminReport = () => {
  const [params, patch] = useAdminUrlState();
  return (
  <AdminPage title="Reports & Records" description="Explore library records or choose a report, apply filters, then preview or download the results.">
    <Tabs value={params.get("tab") === "reports" ? "reports" : "explore"} onValueChange={tab => patch({ tab })} className="space-y-5">
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md border-b border-border bg-transparent p-0">
        <TabsTrigger value="explore" className="min-h-11 shrink-0 rounded-md border-b-2 border-transparent px-5 data-[state=active]:border-action data-[state=active]:bg-transparent data-[state=active]:text-action">Explore Records</TabsTrigger>
        <TabsTrigger value="reports" className="min-h-11 shrink-0 rounded-md border-b-2 border-transparent px-5 data-[state=active]:border-action data-[state=active]:bg-transparent data-[state=active]:text-action">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="explore" className="mt-0"><QueryExplorer /></TabsContent>
      <TabsContent value="reports" className="mt-0"><ReportWorkspace /></TabsContent>
    </Tabs>
  </AdminPage>
);
};

export default AdminReport;
