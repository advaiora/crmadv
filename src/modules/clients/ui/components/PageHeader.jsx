import React from 'react';
import { Breadcrumb, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const PageHeader = ({
    icon: Icon,
    title,
    subtitle,
    breadcrumbs = [],
    actions = null,
    sticky = true,
}) => (
    <Card className={`card-border clients-page-header mb-3 ${sticky ? 'clients-page-header-sticky' : ''}`}>
        <Card.Body className="py-3">
            {breadcrumbs.length > 0 && (
                <Breadcrumb className="clients-breadcrumb mb-2">
                    {breadcrumbs.map((crumb, index) => {
                        const key = `${crumb.label}-${index}`;
                        const isActive = Boolean(crumb.active);

                        if (isActive || !crumb.to) {
                            return (
                                <Breadcrumb.Item key={key} active>
                                    {crumb.label}
                                </Breadcrumb.Item>
                            );
                        }

                        return (
                            <Breadcrumb.Item key={key} linkAs={Link} linkProps={{ to: crumb.to }}>
                                {crumb.label}
                            </Breadcrumb.Item>
                        );
                    })}
                </Breadcrumb>
            )}
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
                <div className="d-flex align-items-start gap-3">
                    {Icon && (
                        <span className="clients-page-header-icon">
                            <Icon size={20} />
                        </span>
                    )}
                    <div>
                        <h4 className="mb-1">{title}</h4>
                        {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
                    </div>
                </div>
                {actions && <div className="d-flex flex-wrap align-items-center gap-2">{actions}</div>}
            </div>
        </Card.Body>
    </Card>
);

export default PageHeader;
