import { useState, useEffect } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { FormField } from "./AdminCatalog.types";
import AdminCatalogData from "./AdminCatalogData";
import AdminCatalogBuilder from "./AdminCatalogBuilder";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPanel } from "../components/AdminPage";

const AdminCatalog = () => {
  const { user } = useAuth();
  const [mode, setMode]               = useState<"catalog" | "builder">("catalog");
  const [fields, setFields]           = useState<FormField[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(true);

  useEffect(() => {
    axiosInstance.get("api/admin/catalog-schema", { params: { includeArchived: "true" } })
      .then((res) => {
        const parsed = res.data.map((f: any) => ({
          ...f,
          options:  typeof f.options  === "string" ? JSON.parse(f.options)  : f.options,
          required: Boolean(f.required),
          locked:   Boolean(f.locked),
          public:   Boolean(f.public),
          archived: Boolean(f.archived),
        }));
        setFields(parsed);
      })
      .catch(() => toast.error("Failed to load form schema"))
      .finally(() => setLoadingSchema(false));
  }, []);

  const canAccessBuilder = user?.role === "admin" || user?.role === "super_admin";

  if (loadingSchema) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <AdminPage
      eyebrow="Library Management"
      title="Catalog Management"
      description="Add, edit, archive, and organize catalog records in a workspace that keeps catalog operations and schema controls clearly separated."
      actions={
        canAccessBuilder ? (
          <>
            <Button
              size="sm"
              variant={mode === "catalog" ? "default" : "outline"}
              onClick={() => setMode("catalog")}
            >
              Catalog
            </Button>
            <Button
              size="sm"
              variant={mode === "builder" ? "default" : "outline"}
              onClick={() => setMode("builder")}
            >
              Form Builder
            </Button>
          </>
        ) : undefined
      }
    >
      <AdminPanel
        title={mode === "catalog" ? "Catalog records" : "Catalog form builder"}
        description={
          mode === "catalog"
            ? "Manage books and copies from the main catalog table."
            : "Adjust the catalog schema fields used when creating or editing records."
        }
        className="border-none bg-transparent shadow-none"
        contentClassName="p-0"
      >
        {mode === "catalog" && <AdminCatalogData fields={fields} />}
        {mode === "builder" && canAccessBuilder && (
          <AdminCatalogBuilder fields={fields} onFieldsChange={setFields} />
        )}
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminCatalog;
