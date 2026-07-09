import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';

// Accesso ai dati delle definizioni di campo personalizzato (Custom Fields, V3).
export const customFieldsRepository = {
  list(workspaceId: string, entity: string) {
    return prisma.customFieldDefinition.findMany({
      where: { workspaceId, entity },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  },

  listActive(workspaceId: string, entity: string) {
    return prisma.customFieldDefinition.findMany({
      where: { workspaceId, entity, active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  },

  findById(workspaceId: string, id: string) {
    return prisma.customFieldDefinition.findFirst({ where: { id, workspaceId } });
  },

  findByKey(workspaceId: string, entity: string, key: string) {
    return prisma.customFieldDefinition.findFirst({ where: { workspaceId, entity, key } });
  },

  async nextOrder(workspaceId: string, entity: string) {
    const result = await prisma.customFieldDefinition.aggregate({
      where: { workspaceId, entity },
      _max: { order: true },
    });
    return (result._max.order ?? -1) + 1;
  },

  create(data: Prisma.CustomFieldDefinitionUncheckedCreateInput) {
    return prisma.customFieldDefinition.create({ data });
  },

  update(id: string, data: Prisma.CustomFieldDefinitionUncheckedUpdateInput) {
    return prisma.customFieldDefinition.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.customFieldDefinition.delete({ where: { id } });
  },

  // Riordina in transazione: assegna order = indice nell'elenco fornito.
  reorder(ids: string[]) {
    return prisma.$transaction(
      ids.map((id, index) =>
        prisma.customFieldDefinition.update({ where: { id }, data: { order: index } }),
      ),
    );
  },
};
