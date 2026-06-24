import React from "react";

const SOURCE_LABEL_MAP = {
  db: "DB",
  mock: "Mock",
  local_fallback: "Local Fallback",
};

const AgencyDataSourceBadge = ({ meta }) => {
  if (!import.meta.env.DEV) {
    return null;
  }

  const source = typeof meta?.source === "string" ? meta.source : "mock";
  const sourceLabel = SOURCE_LABEL_MAP[source] || source;
  const reason = typeof meta?.reason === "string" && meta.reason.trim() ? meta.reason.trim() : "";

  return (
    <span
      className="badge text-bg-light border ms-2"
      title={reason || "Agency data source"}
    >
      Source: {sourceLabel}
    </span>
  );
};

export default AgencyDataSourceBadge;
