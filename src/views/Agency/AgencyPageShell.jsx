import React from "react";
import { Card } from "react-bootstrap";
import { Link } from "react-router-dom";
import AgencyDataSourceBadge from "./AgencyDataSourceBadge";
import "./agency-ui.css";

const AgencyPageShell = ({ title, subtitle, breadcrumbs, dataMeta, children }) => {
  const safeBreadcrumbs = Array.isArray(breadcrumbs) ? breadcrumbs : [];

  return (
    <div className="container-fluid py-4 agency-page-shell">
      <div className="small text-muted mb-2 d-flex flex-wrap align-items-center gap-1">
        {safeBreadcrumbs.map((item, index) => {
          const key = `${item?.label || "breadcrumb"}-${index}`;
          const isLast = index === safeBreadcrumbs.length - 1;

          return (
            <React.Fragment key={key}>
              {item?.to && !isLast ? (
                <Link to={item.to} className="text-muted">
                  {item.label}
                </Link>
              ) : (
                <span>{item?.label || "-"}</span>
              )}
              {!isLast && <span>/</span>}
            </React.Fragment>
          );
        })}
      </div>

      <h3 className="mb-1">{title}</h3>
      <p className="text-muted mb-3">
        {subtitle}
        <AgencyDataSourceBadge meta={dataMeta} />
      </p>

      <Card className="card-border">
        <Card.Body>
          {children || (
            <p className="mb-0 text-muted">
              Placeholder minimale pronto per integrazione incrementale.
            </p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default AgencyPageShell;
