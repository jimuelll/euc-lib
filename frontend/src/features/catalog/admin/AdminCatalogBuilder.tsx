import type { FormField } from "./AdminCatalog.types";
import CatalogBuilderPanels from "./components/CatalogBuilderPanels";
import { useCatalogSchemaBuilder } from "./hooks/useCatalogSchemaBuilder";

type Props = {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
};

const AdminCatalogBuilder = (props: Props) => (
  <CatalogBuilderPanels model={useCatalogSchemaBuilder(props)} />
);

export default AdminCatalogBuilder;

