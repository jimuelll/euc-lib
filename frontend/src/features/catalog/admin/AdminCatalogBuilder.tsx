import type { FormField } from "./AdminCatalog.types";
import CatalogBuilderPanels from "./components/CatalogBuilderPanels";
import CatalogVisibilitySettings from "./components/CatalogVisibilitySettings";
import { useCatalogSchemaBuilder } from "./hooks/useCatalogSchemaBuilder";

type Props = {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
};

const AdminCatalogBuilder = (props: Props) => {
  const model = useCatalogSchemaBuilder(props);
  return <div className="space-y-5">
    <CatalogVisibilitySettings />
    <CatalogBuilderPanels model={model} />
  </div>;
};

export default AdminCatalogBuilder;
