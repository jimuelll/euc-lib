import { AdminPage } from "./components/AdminPage";
import BookTypesSettings from "./adminCatalog/BookTypesSettings";

export default function AdminBookTypes() {
  return <AdminPage title="Book type policies" description="Set the default borrow period and hourly overdue fine for each book type. Catalog records must be assigned one before they can be saved." contentWidth="wide"><BookTypesSettings /></AdminPage>;
}
