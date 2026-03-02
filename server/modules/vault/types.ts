export type VaultItemMeta = {
  id: string;
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
  name: string;
  username?: string | null;
  url?: string | null;
  tags?: string[];
  payload: VaultItemEncryptedPayload;
  actorUserId?: string;
};

export type UpdateVaultItemInput = {
  name?: string;
  username?: string | null;
  url?: string | null;
  tags?: string[];
  payload?: VaultItemEncryptedPayload;
  actorUserId?: string;
};

