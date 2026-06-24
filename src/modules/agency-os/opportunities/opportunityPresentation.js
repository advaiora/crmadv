const PRIORITY_RANK = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const TYPE_ORDER = {
  critical: 4,
  commercial: 3,
  strategic: 2,
  improvement: 1,
};

export const formatOpportunityLabel = (value, fallback = "N/A") => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value
    .trim()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");
};

export const sortAgencyOpportunities = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return [...items].sort((left, right) => {
    const scoreDelta = (right?.score || 0) - (left?.score || 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const priorityDelta = (PRIORITY_RANK[right?.priority] || 0) - (PRIORITY_RANK[left?.priority] || 0);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const typeDelta = (TYPE_ORDER[right?.type] || 0) - (TYPE_ORDER[left?.type] || 0);
    if (typeDelta !== 0) {
      return typeDelta;
    }

    const valueDelta = Number(right?.estimatedValue || 0) - Number(left?.estimatedValue || 0);
    if (valueDelta !== 0) {
      return valueDelta;
    }

    return String(left?.title || "").localeCompare(String(right?.title || ""));
  });
};

export const groupAgencyOpportunities = (items, groupBy = "type") => {
  const sorted = sortAgencyOpportunities(items);
  const groups = new Map();

  sorted.forEach((entry) => {
    const rawKey = groupBy === "category" ? entry?.category : entry?.type;
    const key = typeof rawKey === "string" && rawKey.trim() ? rawKey.trim().toLowerCase() : "other";
    const label = key === "other"
      ? "Altre Opportunita"
      : formatOpportunityLabel(key, "Altro");

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        items: [],
      });
    }

    groups.get(key).items.push(entry);
  });

  return Array.from(groups.values());
};

export const filterAgencyOpportunities = (items, filters = {}) => {
  return sortAgencyOpportunities(items).filter((entry) => {
    if (filters.type && entry?.type !== filters.type) {
      return false;
    }

    if (filters.priority && entry?.priority !== filters.priority) {
      return false;
    }

    if (filters.category && entry?.category !== filters.category) {
      return false;
    }

    if (filters.projectId && entry?.projectId !== filters.projectId) {
      return false;
    }

    return true;
  });
};

export const collectOpportunityFilterValues = (items, key) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return Array.from(
    new Set(
      items
        .map((entry) => (typeof entry?.[key] === "string" ? entry[key].trim() : ""))
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, "it"));
};

export const getOpportunityBadgeClass = (kind, value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (kind === "priority") {
    if (normalized === "urgent" || normalized === "high") {
      return "text-bg-danger";
    }
    if (normalized === "medium") {
      return "text-bg-warning";
    }
    return "text-bg-secondary";
  }

  if (kind === "type") {
    if (normalized === "critical") {
      return "text-bg-danger";
    }
    if (normalized === "commercial") {
      return "text-bg-success";
    }
    if (normalized === "strategic") {
      return "text-bg-primary";
    }
    if (normalized === "improvement") {
      return "text-bg-warning";
    }
    return "text-bg-secondary";
  }

  if (kind === "impact") {
    if (normalized === "urgent" || normalized === "high") {
      return "text-bg-danger";
    }
    if (normalized === "medium") {
      return "text-bg-info";
    }
    return "text-bg-secondary";
  }

  return "text-bg-light border";
};
