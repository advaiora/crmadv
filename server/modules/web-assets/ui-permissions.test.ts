import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWebAssetStatusOptions,
  isPublishControlledStatus,
  isWebAssetStatusFieldDisabled,
} from '../../../src/modules/web-assets/ui/permissions.js';

const STATUSES = [
  { value: 'ACTIVE', label: 'Attivo' },
  { value: 'MAINTENANCE', label: 'Manutenzione' },
  { value: 'PAUSED', label: 'In pausa' },
  { value: 'ARCHIVED', label: 'Archiviato' },
];

test('isPublishControlledStatus identifies publish-controlled states', () => {
  assert.equal(isPublishControlledStatus('ACTIVE'), true);
  assert.equal(isPublishControlledStatus('PAUSED'), true);
  assert.equal(isPublishControlledStatus('MAINTENANCE'), false);
});

test('getWebAssetStatusOptions hides publish-controlled options without web.publish', () => {
  const options = getWebAssetStatusOptions({
    statuses: STATUSES,
    canPublish: false,
    currentStatus: 'MAINTENANCE',
  });

  assert.deepEqual(
    options.map((option) => option.value),
    ['MAINTENANCE', 'ARCHIVED'],
  );
});

test('getWebAssetStatusOptions keeps current publish-controlled value in edit mode', () => {
  const options = getWebAssetStatusOptions({
    statuses: STATUSES,
    canPublish: false,
    currentStatus: 'ACTIVE',
  });

  assert.deepEqual(
    options.map((option) => option.value),
    ['ACTIVE', 'MAINTENANCE', 'ARCHIVED'],
  );
});

test('isWebAssetStatusFieldDisabled disables edit for publish-controlled status without web.publish', () => {
  const disabled = isWebAssetStatusFieldDisabled({
    submitting: false,
    canPublish: false,
    formMode: 'edit',
    currentStatus: 'ACTIVE',
  });

  assert.equal(disabled, true);
});

test('isWebAssetStatusFieldDisabled allows editing non publish-controlled status without web.publish', () => {
  const disabled = isWebAssetStatusFieldDisabled({
    submitting: false,
    canPublish: false,
    formMode: 'edit',
    currentStatus: 'MAINTENANCE',
  });

  assert.equal(disabled, false);
});
