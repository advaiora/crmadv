import React from 'react';
import { Building2, User } from 'lucide-react';
import { getInitials } from '../helpers';

const AVATAR_SIZE = {
    sm: 38,
    md: 46,
};

const ClientAvatar = ({ name, type, size = 'md' }) => {
    const dimension = AVATAR_SIZE[size] || AVATAR_SIZE.md;
    const Icon = type === 'company' ? Building2 : User;

    return (
        <div className="clients-avatar" style={{ width: dimension, height: dimension }}>
            <span className="clients-avatar-text">{getInitials(name)}</span>
            <span className="clients-avatar-icon">
                <Icon size={11} />
            </span>
        </div>
    );
};

export default React.memo(ClientAvatar);
