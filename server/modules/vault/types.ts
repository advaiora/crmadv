export type VaultItemMeta = {
  id: string;
  clientId: string | null;
  client: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  name: string;
  username: string | null;
  url: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type VaultItemEncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
  keyVersion: number;
};

export type VaultSecretPayload = {
  password: string;
  notes: string | null;
  extra: Record<string, unknown> | null;
};

export type VaultItemRecord = VaultItemMeta &
  VaultItemEncryptedPayload & {
    workspaceId: string;
    createdByUserId: string | null;
    updatedByUserId: string | null;
  };

export type ListVaultItemsInput = {
  search?: string;
  tag?: string;
  limit?: number;
  cursor?: string;
};

export type ListVaultItemsResult = {
  items: VaultItemMeta[];
  nextCursor: string | null;
};

export type CreateVaultItemInput = {
  id?: string;
  clientId?: string | null;
  name: string;
  username?: string | null;
  url?: string | null;
  tags?: string[];
  payload: VaultItemEncryptedPayload;
  actorUserId?: string;
};

export type UpdateVaultItemInput = {
  clientId?: string | null;
  name?: string;
  username?: string | null;
  url?: string | null;
  tags?: string[];
  payload?: VaultItemEncryptedPayload;
  actorUserId?: string;
};

export type VaultClientLookupItem = {
  id: string;
  name: string;
  email: string | null;
};
