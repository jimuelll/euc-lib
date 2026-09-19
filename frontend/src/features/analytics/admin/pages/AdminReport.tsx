import { AdminPage } from "@/features/admin";
import QueryExplorer from "@/features/query/QueryExplorer";

const AdminReport = () => (
  <AdminPage title="Query" contentWidth="wide">
    <QueryExplorer />
  </AdminPage>
);

export default AdminReport;
