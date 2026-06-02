# File Support Notes

## Current supported formats

- `.pdf`
- `.txt`
- `.md`
- `.csv`
- `.docx`
- `.doc`
- `.xlsx`
- `.xls`

## Current behavior

- `pdf`: extract text page by page with `pypdf`
- `txt` / `md` / `csv`: decode text directly with encoding fallback
- `docx`: extract paragraphs and simple table rows
- `xlsx`: read a bounded preview from each sheet
- `xls`: read a bounded preview from each sheet using `xlrd`
- `doc`: return a compatibility note instead of unreliable parsing

## Guardrails

- Keep per-file limits bounded
- Favor partial but honest extraction over pretending a binary file was fully read
- If a format is mostly scanned images, consider adding OCR as a separate feature instead of overloading text extraction
