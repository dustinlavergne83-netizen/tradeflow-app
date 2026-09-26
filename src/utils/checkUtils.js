/**
 * checkUtils — helpers for the Print Checks feature.
 *
 * TradeFlow prints checks onto PRE-PRINTED voucher stock (company name,
 * bank name/address, MICR line, and check number are already printed by
 * the bank/check vendor). TradeFlow only prints the variable fields:
 * date, payee, numeric amount, amount-in-words, memo, and the remittance
 * stub detail.
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];
const SCALES = ["", "Thousand", "Million", "Billion"];

function threeDigitsToWords(n) {
  let words = "";
  if (n >= 100) {
    words += `${ONES[Math.floor(n / 100)]} Hundred`;
    n %= 100;
    if (n > 0) words += " ";
  }
  if (n >= 20) {
    words += TENS[Math.floor(n / 10)];
    if (n % 10 > 0) words += `-${ONES[n % 10]}`;
  } else if (n > 0) {
    words += ONES[n];
  }
  return words;
}

/**
 * Convert a dollar amount to the check-writing words format, e.g.
 * 4250.32 -> "Four Thousand Two Hundred Fifty and 32/100"
 * 0       -> "Zero and 00/100"
 */
export function numberToWords(amount) {
  const num = Math.abs(Number(amount) || 0);
  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);

  let words = "";
  if (dollars === 0) {
    words = "Zero";
  } else {
    let remaining = dollars;
    const chunks = [];
    let scaleIndex = 0;
    while (remaining > 0) {
      const chunk = remaining % 1000;
      if (chunk > 0) {
        chunks.unshift(`${threeDigitsToWords(chunk)}${SCALES[scaleIndex] ? " " + SCALES[scaleIndex] : ""}`);
      }
      remaining = Math.floor(remaining / 1000);
      scaleIndex++;
    }
    words = chunks.join(" ");
  }

  const centsStr = String(cents).padStart(2, "0");
  return `${words} and ${centsStr}/100`;
}

/** Format a YYYY-MM-DD date string as MM/DD/YYYY for printing on the check. */
export function formatCheckDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Format a currency amount for the numeric $ box, e.g. 1234.5 -> "1,234.50" */
export function formatCheckAmount(amount) {
  return Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Validate a proposed check number against the bank account's history.
 * Returns { ok: boolean, warning?: string } — never blocks, only warns,
 * since the user may legitimately be re-starting a sequence or skipping
 * a voided/jammed sheet.
 */
export function validateCheckSequence(proposedNumber, lastCheckNumberUsed) {
  const n = parseInt(proposedNumber, 10);
  if (!n || n <= 0) {
    return { ok: false, warning: "Check number must be a positive whole number." };
  }
  if (lastCheckNumberUsed && n <= lastCheckNumberUsed) {
    return {
      ok: true,
      warning: `Check #${n} is not greater than the last check used (#${lastCheckNumberUsed}). Make sure this doesn't duplicate a check you already printed.`,
    };
  }
  if (lastCheckNumberUsed && n > lastCheckNumberUsed + 1) {
    return {
      ok: true,
      warning: `Skipping from #${lastCheckNumberUsed} to #${n} — ${n - lastCheckNumberUsed - 1} check number(s) will be left unused.`,
    };
  }
  return { ok: true };
}
