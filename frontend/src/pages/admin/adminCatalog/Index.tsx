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
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-10">
      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>
            Catalog management
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Find, maintain, and add the records that keep the library collection available.
          </p>
        </div>
        {canAccessBuilder ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className={mode === "catalog" ? "rounded-none border-warning bg-warning text-warning-foreground hover:bg-warning/90" : "rounded-none"} onClick={() => setMode("catalog")}>
              Catalog records
            </Button>
            <Button size="sm" variant="outline" className={mode === "builder" ? "rounded-none border-warning bg-warning text-warning-foreground hover:bg-warning/90" : "rounded-none"} onClick={() => setMode("builder")}>
              Form builder
            </Button>
          </div>
        ) : null}
      </header>

      {mode === "catalog" && <AdminCatalogData fields={fields} />}
      {mode === "builder" && canAccessBuilder && <AdminCatalogBuilder fields={fields} onFieldsChange={setFields} />}
    </main>
  );
};

export default AdminCatalog;
