import React from 'react';
import { Badge } from 'react-bootstrap';
import { Building2, User } from 'lucide-react';
import { getClientTypeLabel } from '../helpers';

const ClientTypeBadge = ({ type }) => {
    const isCompany = type === 'company';
    const Icon = isCompany ? Building2 : User;

    return (
        <Badge pill bg={isCompany ? 'primary' : 'secondary'} className="d-inline-flex align-items-center gap-1">
            <Icon size={12} />
            <span>{getClientTypeLabel(type)}</span>
        </Badge>
    );
};

export default ClientTypeBadge;
