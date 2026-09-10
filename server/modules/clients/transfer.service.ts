import type { FastifyRequest } from 'fastify';
import { audit } from '../../audit/audit.js';
import { badRequest, isHttpError } from '../../core/errors.js';
import { customFieldsService } from '../custom-fields/custom-fields.service.js';
import {
  CSV_HEADER_COLUMNS,
  CUSTOM_FIELD_CSV_PREFIX,
  MAX_IMPORT_ERRORS,
} from './constants.js';
import { stringifyCsv } from './csv.js';
import {
  assertCsvColumns,
  isEmptyCsvRow,
  toExportCsvRow,
  toImportBodyFromCsvRow,
} from './csv-mapper.js';
import {
  readClientImportFile,
  readClientImportJsonBody,
  type ClientImportUpload,
} from './import-file.js';
import { buildImportPreviewRows } from './import-preview.js';
import { parseCreatePayload, parseExportFilters } from './payloads.js';
import { clientsRepository } from './repository.js';
import type { ClientImportError, ClientImportRow, ExportCustomFieldColumn } from './types.js';

// Import ed export CSV dei clienti: estratti da service.ts perché sono il blocco
// piu' grosso del modulo e non condividono niente con la CRUD se non i parser.
export const clientsTransferService = {
  async exportClientsCsv(workspaceId: string, query: unknown) {
    const filters = parseExportFilters(query);
    const [clients, customFieldDefinitions] = await Promise.all([
      clientsRepository.listForExport({
        workspaceId,
        query: filters.query,
        type: filters.type,
        sortField: filters.sortField,
        sortDirection: filters.sortDirection,
      }),
      customFieldsService.listActiveDefinitions(workspaceId, 'client'),
    ]);

    // Una colonna per ogni campo personalizzato attivo, con intestazione "cf:<chiave>".
    const customFieldColumns: ExportCustomFieldColumn[] = customFieldDefinitions.map(
      (definition) => ({
        key: definition.key,
        header: `${CUSTOM_FIELD_CSV_PREFIX}${definition.key}`,
      }),
    );

    const delimiter = ',';
    const csv = stringifyCsv(
      [
        [...CSV_HEADER_COLUMNS, ...customFieldColumns.map((column) => column.header)],
        ...clients.map((client) => toExportCsvRow(client, customFieldColumns)),
      ],
      delimiter,
    );

    const dateToken = new Date().toISOString().slice(0, 10);
    return {
      csv,
      filename: `clients-export-${dateToken}.csv`,
      totalRows: clients.length,
      filters: {
        query: filters.query ?? null,
        type: filters.type ?? null,
        sort: filters.sort,
      },
    };
  },

  async importClientsFromCsv(input: {
    workspaceId: string;
    actorUserId: string;
    request: FastifyRequest;
    // Due strade d'ingresso: `upload` e' il file arrivato come allegato (fino a
    // 20MB, CSV o Excel), `body` e' la vecchia forma JSON `{csv, dryRun}` che
    // resta viva per chi la chiama ancora. La lettura del file sta in
    // import-file.ts; qui comincia la validazione, che non cambia.
    upload?: ClientImportUpload;
    body?: unknown;
  }) {
    const { format, delimiter, rows, dryRun } = input.upload
      ? await readClientImportFile(input.upload)
      : readClientImportJsonBody(input.body);

    if (rows.length === 0) {
      throw badRequest('Il file non contiene nessuna riga.');
    }

    const header = assertCsvColumns(rows[0]);
    const dataRows = rows
      .slice(1)
      .map((row, index) => ({
        row: index + 2,
        values: row,
      }))
      .filter((entry) => !isEmptyCsvRow(entry.values));

    if (dataRows.length === 0) {
      throw badRequest('Il file contiene solo la riga di intestazione: nessun cliente da importare.');
    }

    // Definizioni dei campi personalizzati lette una sola volta: la validazione
    // per riga avviene in memoria, senza interrogare il DB riga per riga.
    const customFieldDefinitions = await customFieldsService.listActiveDefinitions(
      input.workspaceId,
      'client',
    );

    const validRows: ClientImportRow[] = [];
    const errors: ClientImportError[] = [];
    let failedRowsCount = 0;

    dataRows.forEach((entry) => {
      const rowBody = toImportBodyFromCsvRow(header, entry.values);
      try {
        const payload = parseCreatePayload(rowBody);
        const customFields = customFieldsService.validateValuesWithDefinitions(
          customFieldDefinitions,
          rowBody.customFields,
          { enforceRequired: true },
        );
        validRows.push({
          row: entry.row,
          payload,
          customFields,
        });
      } catch (error) {
        failedRowsCount += 1;

        if (errors.length < MAX_IMPORT_ERRORS && isHttpError(error)) {
          errors.push({
            row: entry.row,
            message: error.message,
          });
          return;
        }

        if (errors.length < MAX_IMPORT_ERRORS) {
          errors.push({
            row: entry.row,
            message: 'Unexpected validation error',
          });
        }
      }
    });

    let createdRows = 0;

    if (!dryRun) {
      for (const entry of validRows) {
        try {
          await clientsRepository.create(input.workspaceId, {
            ...entry.payload,
            customFields: entry.customFields,
          });
          createdRows += 1;
        } catch (error) {
          failedRowsCount += 1;
          if (errors.length < MAX_IMPORT_ERRORS) {
            errors.push({
              row: entry.row,
              message: error instanceof Error ? error.message : 'Failed to persist row',
            });
          }
        }
      }
    }

    const failedRows = failedRowsCount;

    await audit.log({
      // La prova senza salvare ha un evento suo: e' una lettura, e con
      // l'anteprima ogni sbirciata prima di confermare diventerebbe una riga di
      // registro indistinguibile da un import vero.
      event: dryRun ? 'clients.import.preview' : 'clients.import',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Client',
      metadata: {
        dryRun,
        format,
        totalRows: dataRows.length,
        validRows: validRows.length,
        createdRows,
        failedRows,
      },
      request: input.request,
    });

    return {
      summary: {
        format,
        delimiter,
        dryRun,
        // Le righe che entrerebbero: solo in prova, perche' e' li' che servono a
        // decidere se confermare. A import fatto sarebbero peso inutile.
        ...(dryRun ? { previewRows: buildImportPreviewRows(validRows) } : {}),
        totalRows: dataRows.length,
        validRows: validRows.length,
        createdRows,
        failedRows,
        errors,
      },
    };
  },
};
