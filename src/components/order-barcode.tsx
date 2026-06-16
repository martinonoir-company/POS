"use client";

// Code128B SVG renderer — minimal, dependency-free.
//
// Order numbers are short (e.g. MN-260616-00042 = 15 chars) and use the
// ASCII subset Code128B covers exactly. The encoder below implements the
// standard pattern table, prepends START B (104), appends the modulo-103
// checksum, then STOP (106) + 2-bar terminator. Encodes to a 95-module
// SVG path; the renderer scales it to fill the width.
//
// Reference: Code128 specification, table 4 (Code Set B).
//
// Used on the POS receipt and the storefront order-confirmation page so
// the returns scanner can read the order number off the printed receipt
// in one motion.

const CODE128B_PATTERNS = [
  '11011001100','11001101100','11001100110','10010011000','10010001100',
  '10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110',
  '10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100',
  '11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000',
  '10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110',
  '10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000',
  '11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100',
  '10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010',
  '11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100',
  '10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110',
  '10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000',
  '11010011100','11000111010',
];
const START_B = 104;
const STOP = 106;
const STOP_PATTERN = '11000111010';

/** Encode a Code128B payload as a bar/space binary string. */
function encodeCode128B(value: string): string {
  const codes: number[] = [START_B];
  for (const ch of value) {
    const code = ch.charCodeAt(0) - 32;
    if (code < 0 || code > 94) {
      // Out-of-range char — skip (callers should sanitise).
      continue;
    }
    codes.push(code);
  }
  // Modulo-103 checksum: START_B + Σ(value_i * (i+1))
  let sum = START_B;
  for (let i = 1; i < codes.length; i++) {
    sum += codes[i]! * i;
  }
  const checksum = sum % 103;
  codes.push(checksum);
  codes.push(STOP);

  let bits = '';
  for (let i = 0; i < codes.length - 1; i++) {
    bits += CODE128B_PATTERNS[codes[i]!];
  }
  bits += STOP_PATTERN; // STOP already includes the 2-bar terminator
  return bits;
}

interface Props {
  value: string;
  /** Display label under the bars. Defaults to the value. */
  label?: string;
  /** Total SVG width in px. Height is 60% of width by default. */
  width?: number;
  className?: string;
}

export default function OrderBarcode({
  value,
  label,
  width = 260,
  className = '',
}: Props) {
  if (!value) return null;
  const bits = encodeCode128B(value);
  const moduleWidth = width / bits.length;
  const height = 56;

  // Build rectangles for every contiguous run of '1' bits.
  const rects: { x: number; w: number }[] = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === '1') {
      let j = i;
      while (j < bits.length && bits[j] === '1') j++;
      rects.push({ x: i * moduleWidth, w: (j - i) * moduleWidth });
      i = j;
    } else {
      i++;
    }
  }

  return (
    <div className={className} style={{ width }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`Barcode for ${value}`}
      >
        <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
        {rects.map((r, idx) => (
          <rect key={idx} x={r.x} y={0} width={r.w} height={height} fill="#000000" />
        ))}
      </svg>
      <div
        style={{
          textAlign: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          letterSpacing: '0.08em',
          color: '#000',
          marginTop: 4,
        }}
      >
        {label ?? value}
      </div>
    </div>
  );
}
