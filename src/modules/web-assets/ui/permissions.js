const PUBLISH_CONTROLLED_STATUSES = new Set(['ACTIVE', 'PAUSED']);

export const isPublishControlledStatus = (status) =>
  PUBLISH_CONTROLLED_STATUSES.has(status);

export const getWebAssetStatusOptions = ({
  statuses,
  canPublish,
  currentStatus,
}) => statuses.filter((status) => (
  canPublish
    || !isPublishControlledStatus(status.value)
    || status.value === currentStatus
));

export const isWebAssetStatusFieldDisabled = ({
  submitting,
  canPublish,
  formMode,
  currentStatus,
}) => submitting
  || (!canPublish && formMode === 'edit' && isPublishControlledStatus(currentStatus));
