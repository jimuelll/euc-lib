import { useState, useEffect } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { FormField } from "./AdminCatalog.types";
import AdminCatalogData from "./AdminCatalogData";
import AdminCatalogBuilder from "./AdminCatalogBuilder";
import { Button } from "@/components/ui/button";

const AdminCatalog = () => {
  const { user } = useAuth();
  const [mode, setMode]               = useState<"catalog" | "builder">("catalog");
  const [fields, setFields]           = useState<FormField[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(true);

  useEffect(() => {
    axiosInstance.get("/admin/catalog-schema")
      .then((res) => {
        const parsed = res.data.map((f: any) => ({
          ...f,
          options:  typeof f.options  === "string" ? JSON.parse(f.options)  : f.options,
          required: Boolean(f.required),
          locked:   Boolean(f.locked),
        }));
        setFields(parsed);
      })
      .catch(() => toast.error("Failed to load form schema"))
      .finally(() => setLoadingSchema(false));
  }, []);

  const canAccessBuilder = user?.role === "admin" || user?.role === "super_admin";

  if (loadingSchema) {
    return <p className="text-sm text-muted-foreground mt-6">Loading...</p>;
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Catalog Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add, edit, or remove books from the catalog.</p>
        </div>
        {canAccessBuilder && (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

      {mode === "catalog" && <AdminCatalogData fields={fields} />}
      {mode === "builder" && canAccessBuilder && (
        <AdminCatalogBuilder fields={fields} onFieldsChange={setFields} />
      )}
    </div>
  );
};

export default AdminCatalog;