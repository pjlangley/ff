#!/bin/bash
set -e

# Sample `anchor keys list` output (`INPUT_FILE`):
# ```
# counter: DrpgikQv9cukobdxUpVwAjihF3aJ724NZBz2s8gSx1fr
# program2: 2dTGzD92JkBa2UWwxuLyGknfX4SmL4DSKDWzsiEXGbiX
# ```

INPUT_FILE="$1"
OUTPUT_FILE="$2"

if [[ -z "$INPUT_FILE" || -z "$OUTPUT_FILE" ]]; then
  echo "Usage: $0 <input_file> <output_file>"
  exit 1
fi

# Clear or create the output file
> "$OUTPUT_FILE"

while read -r line; do
  program_name=$(echo "$line" | cut -d':' -f1 | xargs)
  program_id=$(echo "$line" | cut -d':' -f2 | xargs)
  echo "${program_name}_PROGRAM_ID=${program_id}" >> "$OUTPUT_FILE"
done < "$INPUT_FILE"

echo "✅ Extracted keys written to $OUTPUT_FILE"
