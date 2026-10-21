# BLS 4.0 (Excel von https://www.blsdb.de, kostenlos) -> bls_motivator.csv für die Tabelle public.bls_foods.
# Die Excel-Datei und die CSV liegen NICHT im Repo (Weitergabe-Bedingungen unklar) – nur in Jans Supabase.
# Aufruf: python3 bls_aufbereiten.py BLS_4_0_Daten_2025_DE.xlsx  -> bls_motivator.csv
import csv, sys
import openpyxl

SPALTEN = {
    'code': 'BLS Code', 'name': 'Lebensmittelbezeichnung',
    'kcal': 'ENERCC Energie (Kilokalorien) [kcal/100g]',
    'protein': 'PROT625 Protein (Nx6,25) [g/100g]',
    'fat': 'FAT Fett [g/100g]',
    'carbs': 'CHO Kohlenhydrate, verfügbar [g/100g]',
    'fiber': 'FIBT Ballaststoffe, gesamt [g/100g]',
    'sugar': 'SUGAR Zucker (Mono- und Disaccharide), gesamt [g/100g]',
    'salt': 'NACL Salz (Natriumchlorid) [g/100g]',
    'iron': 'FE Eisen [mg/100g]',
    'zinc': 'ZN Zink [mg/100g]',
    'magnesium': 'MG Magnesium [mg/100g]',
    'calcium': 'CA Calcium [mg/100g]',
    'potassium': 'K Kalium [mg/100g]',
    'folate': 'FOL Folat-Äquivalent [µg/100g]',
    'vit_c': 'VITC Vitamin C [mg/100g]',
    'vit_b12': 'VITB12 Vitamin B12 (Cobalamine) [µg/100g]',
    'vit_d': 'VITD Vitamin D [µg/100g]',
    'iodine': 'ID Iodid [µg/100g]',
}
KERN = {'kcal', 'protein', 'fat', 'carbs'}
NULL_WERTE = {'<LOD', '<LOQ', '<LOD or <LOQ', 'TR'}  # unter Nachweisgrenze / Spuren -> 0

ws = openpyxl.load_workbook(sys.argv[1], read_only=True).active
zeilen = ws.iter_rows(values_only=True)
kopf = next(zeilen)
idx = {k: kopf.index(v) for k, v in SPALTEN.items()}
n = 0
with open(sys.argv[2] if len(sys.argv) > 2 else 'bls_motivator.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(SPALTEN))
    w.writeheader()
    for z in zeilen:
        if not z[idx['code']]:
            continue
        r = {k: z[i] for k, i in idx.items()}
        for k in SPALTEN:
            if k in ('code', 'name'):
                continue
            v = r[k]
            if isinstance(v, (int, float)):
                r[k] = round(float(v), 4)
                continue
            # „-“ = nicht bestimmt: bei den Kernwerten 0, sonst leer (unbekannt)
            r[k] = 0 if v in NULL_WERTE or k in KERN else None
        w.writerow(r)
        n += 1
print(n, 'Lebensmittel')
