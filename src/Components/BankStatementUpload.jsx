import { useState } from "react";
import Papa from "papaparse";

export default function BankStatementUpload({ bankAccountId, transferAccounts = [], onImportComplete }) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [headers, setHeaders] = useState([]);
  // 'single'  = one Amount column (positive = deposit, negative = withdrawal)
  // 'split'   = separate Withdrawal/Debit and Deposit/Credit columns, as
  //             most banks export (e.g. "Debits (-)" / "Credits(+)")
  const [amountMode, setAmountMode] = useState('single');
  const [mapping, setMapping] = useState({
    date: '',
    description: '',
    amount: '',
    withdrawal: '',
    deposit: '',
    reference: '',
    type: '',
    payee: '',
  });
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [transactionCategories, setTransactionCategories] = useState({});

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    setFile(file);
    
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('Papa parse results:', results);
        
        if (results.data && results.data.length > 0) {
          let headers = results.data[0];
          let dataRows = results.data.slice(1);
          
          // Check if we got only 1 column (parsing failed)
          if (headers.length === 1 && headers[0].includes(',')) {
            console.log('Manual parsing needed - splitting by comma');
            // Manually split by comma
            headers = headers[0].split(',').map(h => h.trim());
            dataRows = dataRows.map(row => {
              if (row.length === 1 && row[0].includes(',')) {
                return row[0].split(',').map(cell => cell.trim());
              }
              return row;
            });
          }
          
          console.log('Final headers:', headers);
          console.log('Final sample row:', dataRows[0]);
          
          setHeaders(headers);
          setParsedData(dataRows);
          setPreview(dataRows.slice(0, 5));
          
          autoDetectMapping(headers);
        }
      },
      error: (error) => {
        console.error('Parse error:', error);
        alert('Error: ' + error.message);
      }
    });
  };

  const autoDetectMapping = (headers) => {
    const newMapping = { ...mapping };

    // First pass: detect a dedicated Payee column before anything else gets
    // a chance to claim it. A CSV with its own "Payee" column should always
    // map Payee -> Payee, not have it swallowed by Description.
    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase().trim();
      if (!newMapping.payee && (
        lowerHeader.includes('payee') ||
        lowerHeader.includes('merchant') ||
        lowerHeader === 'name'
      )) {
        newMapping.payee = index.toString();
      }
    });

    // Second pass: detect separate withdrawal/debit and deposit/credit
    // columns BEFORE the single-amount pass below, so a file like
    // "Debits (-)" / "Credits(+)" gets routed to split mode instead of
    // single-amount grabbing just the Debits column. "balance" is
    // excluded so a running-balance column is never mistaken for one
    // of these.
    let detectedWithdrawal = '';
    let detectedDeposit = '';
    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase().trim();
      if (lowerHeader.includes('balance')) return;

      if (!detectedWithdrawal && (
        lowerHeader.includes('withdrawal') ||
        lowerHeader.includes('debit') ||
        lowerHeader.includes('money out') ||
        lowerHeader.includes('paid out')
      )) {
        detectedWithdrawal = index.toString();
      }
      if (!detectedDeposit && (
        lowerHeader.includes('deposit') ||
        lowerHeader.includes('credit') ||
        lowerHeader.includes('money in') ||
        lowerHeader.includes('paid in')
      )) {
        detectedDeposit = index.toString();
      }
    });

    let detectedMode = 'single';
    if (detectedWithdrawal && detectedDeposit && detectedWithdrawal !== detectedDeposit) {
      detectedMode = 'split';
      newMapping.withdrawal = detectedWithdrawal;
      newMapping.deposit = detectedDeposit;
    }

    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase().trim();

      // Date detection
      if (!newMapping.date && (
        lowerHeader.includes('date') ||
        lowerHeader.includes('posting') ||
        lowerHeader.includes('trans date')
      )) {
        newMapping.date = index.toString();
      }

      // Description detection. Payee is only used as a last-resort
      // fallback, and only if that column was not already claimed as the
      // dedicated Payee field above.
      if (!newMapping.description && (
        lowerHeader.includes('description') ||
        lowerHeader.includes('memo') ||
        lowerHeader.includes('details') ||
        (lowerHeader.includes('payee') && newMapping.payee !== index.toString())
      )) {
        newMapping.description = index.toString();
      }

      // Single amount column detection — only used when a split
      // withdrawal/deposit pair was NOT found above.
      if (detectedMode === 'single' && !newMapping.amount && (
        lowerHeader.includes('amount') ||
        lowerHeader.includes('debit') ||
        lowerHeader.includes('credit') ||
        lowerHeader.includes('withdrawal') ||
        lowerHeader.includes('deposit')
      )) {
        newMapping.amount = index.toString();
      }
      
      // Reference/Check number detection
      if (!newMapping.reference && (
        lowerHeader.includes('check') ||
        lowerHeader.includes('reference') ||
        lowerHeader.includes('number') ||
        lowerHeader.includes('trans id')
      )) {
        newMapping.reference = index.toString();
      }
      
      // Transaction type detection
      if (!newMapping.type && (
        lowerHeader.includes('type') ||
        lowerHeader.includes('category') ||
        lowerHeader.includes('transaction type')
      )) {
        newMapping.type = index.toString();
      }
    });

    setAmountMode(detectedMode);
    setMapping(newMapping);
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Try various date formats
    const formats = [
      // MM/DD/YYYY or MM-DD-YYYY
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
      // YYYY-MM-DD
      /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
      // DD/MM/YYYY (common in Europe)
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
    ];
    
    for (let format of formats) {
      const match = dateStr.match(format);
      if (match) {
        try {
          // Assume MM/DD/YYYY for ambiguous formats
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return null;
  };

  const parseAmount = (amountStr) => {
    if (!amountStr) return 0;
    
    // Remove currency symbols, commas, and spaces
    let cleaned = amountStr.toString()
      .replace(/[$,\s]/g, '')
      .replace(/[()]/g, '-') // Negative amounts in parentheses
      .trim();
    
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  };

  // Resolves one row's signed amount from separate withdrawal/deposit
  // columns. A cell is treated as "unused" whenever it parses to zero —
  // this covers both a truly blank cell AND a bank that writes "0.00" in
  // the column that doesn't apply to this row (common export pattern),
  // without special-casing the raw string. Banks don't record genuine
  // $0.00 transactions, so there's no real case this misclassifies.
  //
  // The sign is forced regardless of how the bank wrote the cell — some
  // banks already parenthesize debits (so parseAmount gives a negative),
  // others export bare positives in both columns — so
  // -Math.abs()/+Math.abs() makes this correct either way.
  //
  // Returns { amount, error } — error is set only when BOTH columns
  // parse to a non-zero value (a genuinely ambiguous row), so the caller
  // can flag and skip it instead of silently netting two numbers together.
  const resolveSplitAmount = (withdrawalCell, depositCell) => {
    const w = parseAmount(withdrawalCell);
    const d = parseAmount(depositCell);

    if (w !== 0 && d !== 0) {
      return { amount: 0, error: 'both withdrawal and deposit columns have a value' };
    }
    if (w !== 0) return { amount: -Math.abs(w), error: null };
    if (d !== 0) return { amount: Math.abs(d), error: null };
    return { amount: 0, error: null }; // both blank/zero — not an error, just nothing to import
  };

  const determineTransactionType = (amount, typeStr) => {
    if (typeStr) {
      const lower = typeStr.toLowerCase();
      if (lower.includes('deposit') || lower.includes('credit')) return 'deposit';
      if (lower.includes('withdraw') || lower.includes('debit') || lower.includes('payment')) return 'withdrawal';
      if (lower.includes('transfer')) return 'transfer';
      if (lower.includes('fee')) return 'fee';
      if (lower.includes('interest')) return 'interest';
    }
    
    // Default based on amount
    return amount >= 0 ? 'deposit' : 'withdrawal';
  };

  // Detect an INTERNAL transfer from the description, e.g. "JDB XFER TO 5428",
  // "OLB XFER FROM 3038". Only treated as a transfer when a 4+ digit number
  // in the description matches one of THIS company's OTHER
  // bank_accounts.account_number values — matching on the word
  // "transfer"/"xfer" alone is NOT enough. Descriptions like "OLB XFER TO
  // 1321" go to an external/personal account (a real Owner Draw expense),
  // and must stay a normal withdrawal for you to categorize as usual — only
  // a confirmed match against a real TradeFlow bank account gets relabeled.
  // Returns { isTransfer, transferAccountId }.
  function detectTransfer(description) {
    const numberMatches = (description || '').match(/\d{4,}/g) || [];
    for (const num of numberMatches) {
      const last4 = num.slice(-4);
      const match = transferAccounts.find(a => a.account_number && a.account_number === last4);
      if (match) return { isTransfer: true, transferAccountId: match.id };
    }
    return { isTransfer: false, transferAccountId: null };
  }

  const handleImport = async () => {
    const hasAmountMapping = amountMode === 'split'
      ? (mapping.withdrawal || mapping.deposit)
      : mapping.amount;

    if (!mapping.date || !mapping.description || !hasAmountMapping) {
      alert(amountMode === 'split'
        ? 'Please map Date, Description, and at least one of Withdrawal/Deposit columns'
        : 'Please map at least Date, Description, and Amount columns');
      return;
    }

    if (!parsedData || parsedData.length === 0) {
      alert('No data to import');
      return;
    }

    setImporting(true);
    const transactions = [];
    const errors = [];

    parsedData.forEach((row, index) => {
      try {
        const date = parseDate(row[parseInt(mapping.date)]);
        const description = row[parseInt(mapping.description)]?.trim();

        let amount = 0;

        if (amountMode === 'split') {
          // Separate Withdrawal/Debit and Deposit/Credit columns — read
          // whichever cell is populated and force the sign so a bare
          // positive number in the Withdrawals column (no parentheses,
          // no minus sign) still imports as a negative amount. See
          // resolveSplitAmount for the blank-vs-both-populated logic.
          const withdrawalCell = mapping.withdrawal ? row[parseInt(mapping.withdrawal)] : undefined;
          const depositCell = mapping.deposit ? row[parseInt(mapping.deposit)] : undefined;
          const { amount: resolved, error: splitError } = resolveSplitAmount(withdrawalCell, depositCell);
          if (splitError) {
            errors.push(`Row ${index + 2}: ${splitError} — row skipped`);
            return;
          }
          amount = resolved;
        } else {
          // Single amount column. Kept exactly as before, including the
          // adjacent-column fallback, so existing single-column CSVs that
          // already work are unaffected by this change.
          const amountColIndex = parseInt(mapping.amount);
          const amountStr = row[amountColIndex];
          amount = parseAmount(amountStr);

          // If amount is 0, check adjacent columns (common for debit/credit columns)
          if (amount === 0) {
            // Check next column
            if (row[amountColIndex + 1]) {
              amount = parseAmount(row[amountColIndex + 1]);
            }
            // If still 0, check previous column
            if (amount === 0 && row[amountColIndex - 1]) {
              amount = parseAmount(row[amountColIndex - 1]);
            }
          }
        }
        
        const reference = mapping.reference ? row[parseInt(mapping.reference)]?.trim() : '';
        const typeStr = mapping.type ? row[parseInt(mapping.type)]?.trim() : '';
        const payee = mapping.payee ? row[parseInt(mapping.payee)]?.trim() : '';

        if (!date || !description || amount === 0) {
          errors.push(`Row ${index + 2}: Missing or invalid date, description, or amount`);
          return;
        }

        let transactionType = determineTransactionType(amount, typeStr);
        const { isTransfer, transferAccountId } = detectTransfer(description);
        if (isTransfer) transactionType = 'transfer';

        transactions.push({
          transaction_date: date,
          description: description,
          amount: amount,
          reference_number: reference || null,
          transaction_type: transactionType,
          category: null,
          payee: payee || null,
          transfer_account_id: transferAccountId,
          notes: `Imported from ${file.name}`,
        });
      } catch (err) {
        errors.push(`Row ${index + 2}: ${err.message}`);
      }
    });

    if (errors.length > 0) {
      console.warn('Import errors:', errors);
      if (!confirm(`${errors.length} row(s) had errors and will be skipped. Continue with ${transactions.length} valid transactions?`)) {
        setImporting(false);
        return;
      }
    }

    if (transactions.length === 0) {
      alert('No valid transactions to import');
      setImporting(false);
      return;
    }

    // Pass transactions back to parent component
    onImportComplete(transactions);
    setImporting(false);
  };

  const resetUpload = () => {
    setFile(null);
    setParsedData(null);
    setHeaders([]);
    setAmountMode('single');
    setMapping({
      date: '',
      description: '',
      amount: '',
      withdrawal: '',
      deposit: '',
      reference: '',
      type: '',
      payee: '',
    });
    setPreview([]);
  };

  if (!file) {
    return (
      <div style={styles.container}>
        <div
          style={{
            ...styles.dropZone,
            ...(dragActive ? styles.dropZoneActive : {})
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div style={styles.uploadIcon}>📁</div>
          <h3 style={styles.uploadTitle}>Upload Bank Statement CSV</h3>
          <p style={styles.uploadText}>Drag and drop your CSV file here, or click to browse</p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            style={styles.fileInput}
            id="csv-upload"
          />
          <label htmlFor="csv-upload" style={styles.browseButton}>
            Browse Files
          </label>
          <div style={styles.supportedFormats}>
            <p style={styles.formatText}>Supported formats:</p>
            <ul style={styles.formatList}>
              <li>CSV files from banks (Chase, Wells Fargo, Bank of America, etc.)</li>
              <li>Exported accounting software statements</li>
              <li>Any CSV with date, description, and amount columns</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Map CSV Columns</h3>
          <p style={styles.subtitle}>File: {file.name} ({parsedData?.length || 0} transactions)</p>
        </div>
        <button onClick={resetUpload} style={styles.cancelButton}>
          ← Choose Different File
        </button>
      </div>

      <div style={styles.mappingSection}>
        <p style={styles.mappingInstructions}>
          Match your CSV columns to the required fields. We've auto-detected some mappings for you.
        </p>
        
        <div style={styles.mappingGrid}>
          <div style={styles.mappingRow}>
            <label style={styles.mappingLabel}>
              Transaction Date <span style={styles.required}>*</span>
            </label>
            <select
              value={mapping.date}
              onChange={(e) => setMapping({...mapping, date: e.target.value})}
              onClick={(e) => e.stopPropagation()}
              style={styles.mappingSelect}
            >
              <option value="">-- Select Column --</option>
              {headers.map((header, index) => (
                <option key={index} value={index}>{header}</option>
              ))}
            </select>
          </div>

          <div style={styles.mappingRow}>
            <label style={styles.mappingLabel}>
              Description <span style={styles.required}>*</span>
            </label>
            <select
              value={mapping.description}
              onChange={(e) => setMapping({...mapping, description: e.target.value})}
              onClick={(e) => e.stopPropagation()}
              style={styles.mappingSelect}
            >
              <option value="">-- Select Column --</option>
              {headers.map((header, index) => (
                <option key={index} value={index}>{header}</option>
              ))}
            </select>
          </div>

          <div style={styles.mappingRow}>
            <label style={styles.mappingLabel}>
              Payee (Optional)
            </label>
            <select
              value={mapping.payee}
              onChange={(e) => setMapping({...mapping, payee: e.target.value})}
              onClick={(e) => e.stopPropagation()}
              style={styles.mappingSelect}
            >
              <option value="">-- Select Column --</option>
              {headers.map((header, index) => (
                <option key={index} value={index}>{header}</option>
              ))}
            </select>
            <p style={styles.fieldNote}>
              Used for vendor/bill matching and search. Leave unmapped if your CSV has no separate payee column.
            </p>
          </div>

          <div style={styles.mappingRow}>
            <label style={styles.mappingLabel}>
              Amount Columns <span style={styles.required}>*</span>
            </label>
            <div style={styles.amountModeToggle}>
              <label style={styles.amountModeOption}>
                <input
                  type="radio"
                  name="amountMode"
                  checked={amountMode === 'single'}
                  onChange={() => setAmountMode('single')}
                />
                {' '}Single amount column
              </label>
              <label style={styles.amountModeOption}>
                <input
                  type="radio"
                  name="amountMode"
                  checked={amountMode === 'split'}
                  onChange={() => setAmountMode('split')}
                />
                {' '}Separate withdrawal / deposit columns
              </label>
            </div>

            {amountMode === 'single' ? (
              <>
                <select
                  value={mapping.amount}
                  onChange={(e) => setMapping({...mapping, amount: e.target.value})}
                  onClick={(e) => e.stopPropagation()}
                  style={styles.mappingSelect}
                >
                  <option value="">-- Select Column --</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index}>{header}</option>
                  ))}
                </select>
                <p style={styles.fieldNote}>
                  Positive for deposits, negative for withdrawals. Use parentheses () for negatives.
                </p>
              </>
            ) : (
              <div style={styles.splitAmountGrid}>
                <div>
                  <label style={styles.fieldNote}>Withdrawals (money out)</label>
                  <select
                    value={mapping.withdrawal}
                    onChange={(e) => setMapping({...mapping, withdrawal: e.target.value})}
                    onClick={(e) => e.stopPropagation()}
                    style={styles.mappingSelect}
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>{header}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={styles.fieldNote}>Deposits (money in)</label>
                  <select
                    value={mapping.deposit}
                    onChange={(e) => setMapping({...mapping, deposit: e.target.value})}
                    onClick={(e) => e.stopPropagation()}
                    style={styles.mappingSelect}
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>{header}</option>
                    ))}
                  </select>
                </div>
                <p style={{...styles.fieldNote, gridColumn: '1 / -1'}}>
                  Whichever column has a value for a given row wins. The sign is applied
                  automatically — withdrawals always import negative, deposits always positive —
                  regardless of how your bank formats the number.
                </p>
              </div>
            )}
          </div>

          <div style={styles.mappingRow}>
            <label style={styles.mappingLabel}>
              Reference/Check Number (Optional)
            </label>
            <select
              value={mapping.reference}
              onChange={(e) => setMapping({...mapping, reference: e.target.value})}
              onClick={(e) => e.stopPropagation()}
              style={styles.mappingSelect}
            >
              <option value="">-- Select Column --</option>
              {headers.map((header, index) => (
                <option key={index} value={index}>{header}</option>
              ))}
            </select>
          </div>

          <div style={styles.mappingRow}>
            <label style={styles.mappingLabel}>
              Transaction Type (Optional)
            </label>
            <select
              value={mapping.type}
              onChange={(e) => setMapping({...mapping, type: e.target.value})}
              onClick={(e) => e.stopPropagation()}
              style={styles.mappingSelect}
            >
              <option value="">-- Select Column --</option>
              {headers.map((header, index) => (
                <option key={index} value={index}>{header}</option>
              ))}
            </select>
            <p style={styles.fieldNote}>
              Will auto-detect from amount if not specified
            </p>
          </div>
        </div>
      </div>

      {preview.length > 0 && (
        <div style={styles.previewSection}>
          <h4 style={styles.previewTitle}>Preview (First 5 Rows)</h4>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Payee</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Reference</th>
                  <th style={styles.th}>Type</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => {
                  const date = mapping.date ? parseDate(row[parseInt(mapping.date)]) : '';
                  const description = mapping.description ? row[parseInt(mapping.description)] : '';
                  const payee = mapping.payee ? row[parseInt(mapping.payee)] : '';

                  let amount = 0;
                  if (amountMode === 'split') {
                    const withdrawalCell = mapping.withdrawal ? row[parseInt(mapping.withdrawal)] : undefined;
                    const depositCell = mapping.deposit ? row[parseInt(mapping.deposit)] : undefined;
                    amount = resolveSplitAmount(withdrawalCell, depositCell).amount;
                  } else {
                    amount = mapping.amount ? parseAmount(row[parseInt(mapping.amount)]) : 0;
                  }

                  const reference = mapping.reference ? row[parseInt(mapping.reference)] : '';
                  const typeStr = mapping.type ? row[parseInt(mapping.type)] : '';
                  const type = determineTransactionType(amount, typeStr);

                  return (
                    <tr key={index} style={styles.tableRow}>
                      <td style={styles.td}>{date || '❌ Invalid'}</td>
                      <td style={styles.td}>{description || '❌ Missing'}</td>
                      <td style={styles.td}>{payee || '-'}</td>
                      <td style={{...styles.td, color: amount >= 0 ? '#10b981' : '#ef4444'}}>
                        ${Math.abs(amount).toFixed(2)}
                      </td>
                      <td style={styles.td}>{reference || '-'}</td>
                      <td style={styles.td}>{type}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={styles.actions}>
        <button onClick={resetUpload} style={styles.secondaryButton}>
          Cancel
        </button>
        {(() => {
          const hasAmountMapping = amountMode === 'split'
            ? (mapping.withdrawal || mapping.deposit)
            : mapping.amount;
          const isDisabled = importing || !mapping.date || !mapping.description || !hasAmountMapping;
          return (
            <button
              onClick={handleImport}
              disabled={isDisabled}
              style={{
                ...styles.importButton,
                ...(isDisabled ? styles.disabledButton : {})
              }}
            >
              {importing ? '⏳ Importing...' : `✓ Import ${parsedData?.length || 0} Transactions`}
            </button>
          );
        })()}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: 20,
  },
  dropZone: {
    border: '3px dashed #cbd5e1',
    borderRadius: 12,
    padding: 60,
    textAlign: 'center',
    backgroundColor: '#f8fafc',
    transition: 'all 0.3s',
    cursor: 'pointer',
  },
  dropZoneActive: {
    borderColor: '#fc6b04',
    backgroundColor: '#fff7ed',
  },
  uploadIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  uploadTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  fileInput: {
    display: 'none',
  },
  browseButton: {
    display: 'inline-block',
    padding: '12px 32px',
    backgroundColor: '#fc6b04',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: 24,
  },
  supportedFormats: {
    marginTop: 32,
    textAlign: 'left',
    maxWidth: 600,
    margin: '32px auto 0',
  },
  formatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  formatList: {
    fontSize: 14,
    color: '#666',
    paddingLeft: 24,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cancelButton: {
    padding: '8px 16px',
    backgroundColor: '#fff',
    color: '#666',
    border: '2px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
  },
  mappingSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    border: '2px solid #e5e7eb',
  },
  mappingInstructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  mappingGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  mappingRow: {
    display: 'flex',
    flexDirection: 'column',
  },
  mappingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  mappingSelect: {
    padding: '10px 12px',
    fontSize: 15,
    border: '2px solid #e5e7eb',
    borderRadius: 6,
    outline: 'none',
    backgroundColor: '#fff',
    color: '#111',
    cursor: 'pointer',
    appearance: 'auto',
    position: 'relative',
    zIndex: 1001,
  },
  amountModeToggle: {
    display: 'flex',
    gap: 20,
    marginBottom: 10,
  },
  amountModeOption: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 14,
    color: '#333',
    cursor: 'pointer',
  },
  splitAmountGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  fieldNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  previewSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    border: '2px solid #e5e7eb',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16,
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    padding: '12px',
    textAlign: 'left',
    fontWeight: '700',
    color: '#374151',
    backgroundColor: '#f9fafb',
    borderBottom: '2px solid #e5e7eb',
  },
  tableRow: {
    borderBottom: '1px solid #e5e7eb',
  },
  td: {
    padding: '12px',
    color: '#111',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
  },
  secondaryButton: {
    padding: '12px 24px',
    backgroundColor: '#fff',
    color: '#666',
    border: '2px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    cursor: 'pointer',
  },
  importButton: {
    padding: '12px 32px',
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  disabledButton: {
    backgroundColor: '#cbd5e1',
    cursor: 'not-allowed',
  },
};
