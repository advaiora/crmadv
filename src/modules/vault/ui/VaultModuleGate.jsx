import React from 'react';
import ModulePermissionGate from '../../../components/guards/ModulePermissionGate';
import { VAULT_MODULE_KEY, VAULT_PERMISSIONS } from './constants';

const VaultModuleGate = ({
    requiredPermission = VAULT_PERMISSIONS.viewList,
    children,
}) => (
    <ModulePermissionGate
        requiredModule={VAULT_MODULE_KEY}
        requiredPermission={requiredPermission}
        moduleName="Credenziali"
    >
        {children}
    </ModulePermissionGate>
);

export default VaultModuleGate;
