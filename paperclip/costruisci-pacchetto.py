#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Costruisce il pacchetto dell'azienda di agent per Paperclip.

    python paperclip/costruisci-pacchetto.py

Prende i sorgenti da `paperclip/crm/` e scrive `paperclip/azienda-crm.zip`.

Perche' esiste invece di una riga di `Compress-Archive`. Tre motivi, tutti gia' costati
qualcosa il 26/8/2026:

  1. La cartella radice dentro lo zip DEVE chiamarsi come l'azienda (`crm/`), che e' lo slug
     dichiarato in COMPANY.md. Con `Compress-Archive` la radice prende il nome della cartella
     sorgente: basta rinominare quella e il pacchetto si rompe in silenzio. E' successo — lo zip
     precedente aveva radice `azienda-crm/` mentre il comando documentato ne produceva una
     chiamata `azienda/`, e nessuna delle due era quella giusta.
  2. I fine-riga: i sorgenti su Windows sono CRLF, ma il pacchetto viaggia verso una macchina
     Linux. Qui si normalizza a LF, come fa l'export vero di Paperclip.
  3. La data e' fissa, cosi' due costruzioni con lo stesso contenuto danno lo stesso file e
     `git status` non segnala modifiche fantasma a ogni rigenerazione.

Serve solo Python 3 (`zipfile` e' nella libreria standard). Il progetto e' basato su Node, ma
questo e' uno strumento di confezionamento a se' stante: e' in Python perche' cosi' funziona
anche sulle macchine dove l'ambiente di sviluppo del CRM non e' installato.
"""

import os
import sys
import zipfile

QUI = os.path.dirname(os.path.abspath(__file__))
SORGENTI = os.path.join(QUI, 'crm')
RADICE_ZIP = 'crm'  # = slug dell'azienda dichiarato in COMPANY.md
USCITA = os.path.join(QUI, 'azienda-crm.zip')

# Data fissa (1/1/2026 00:00), per rendere la costruzione riproducibile.
DATA_FISSA = (2026, 1, 1, 0, 0, 0)


def elenca_file(radice):
    """Tutti i file sotto `radice`, in ordine stabile, con separatori Unix."""
    trovati = []
    for cartella, sottocartelle, file in os.walk(radice):
        sottocartelle.sort()
        for nome in sorted(file):
            assoluto = os.path.join(cartella, nome)
            relativo = os.path.relpath(assoluto, radice).replace(os.sep, '/')
            trovati.append((assoluto, relativo))
    return sorted(trovati, key=lambda coppia: coppia[1])


def main():
    if not os.path.isdir(SORGENTI):
        sys.exit('Cartella dei sorgenti non trovata: %s' % SORGENTI)

    file = elenca_file(SORGENTI)
    if not file:
        sys.exit('Nessun file in %s. Non costruisco uno zip vuoto.' % SORGENTI)

    totale_originale = 0
    with zipfile.ZipFile(USCITA, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zip_uscita:
        for assoluto, relativo in file:
            with open(assoluto, encoding='utf-8') as sorgente:
                # Tutto il pacchetto e' testo: si normalizza a LF, come l'export vero.
                contenuto = sorgente.read().replace('\r\n', '\n').encode('utf-8')
            voce = zipfile.ZipInfo('%s/%s' % (RADICE_ZIP, relativo), date_time=DATA_FISSA)
            voce.compress_type = zipfile.ZIP_DEFLATED
            voce.external_attr = 0o644 << 16
            zip_uscita.writestr(voce, contenuto)
            totale_originale += len(contenuto)

    print('Pacchetto scritto: %s' % os.path.relpath(USCITA, os.getcwd()))
    print('  cartella radice : %s/' % RADICE_ZIP)
    print('  file            : %d' % len(file))
    print('  dimensione      : %d byte (%d decompressi)'
          % (os.path.getsize(USCITA), totale_originale))


if __name__ == '__main__':
    main()
