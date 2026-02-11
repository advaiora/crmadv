export const CLIENTS_MODULE_KEY = "clients";

export const CLIENTS_PERMISSIONS = {
  view: "clients.view",
  create: "clients.create",
  edit: "clients.edit",
  delete: "clients.delete",
};

export const CLIENTS_SORT_OPTIONS = [
  { value: "-updatedAt", label: "Aggiornati di recente" },
  { value: "name", label: "Nome A-Z" },
  { value: "-name", label: "Nome Z-A" },
];

export const CLIENTS_TYPE_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "person", label: "Persona" },
  { value: "company", label: "Azienda" },
];

export const CLIENTS_PAGE_SIZE_OPTIONS = [20, 50, 100];

export const CLIENTS_PRESET_TAGS = ["Web", "Marketing", "Social"];
