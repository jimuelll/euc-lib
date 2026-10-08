import AdminUsersWorkspace from "./AdminUsersWorkspace";
import { useAdminManage } from "./useAdminManage";
export default function AdminManage() { return <AdminUsersWorkspace {...useAdminManage()} />; }
