import React from 'react';
import ModulePermissionGate from '../../../components/guards/ModulePermissionGate';
import { CALENDAR_MODULE_KEY, CALENDAR_PERMISSIONS } from './constants';

const CalendarModuleGate = ({ requiredPermission = CALENDAR_PERMISSIONS.view, children }) => (
  <ModulePermissionGate
    requiredModule={CALENDAR_MODULE_KEY}
    requiredPermission={requiredPermission}
    moduleName="Calendario"
  >
    {children}
  </ModulePermissionGate>
);

export default CalendarModuleGate;
