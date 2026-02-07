-- Allow deletion of orphaned posted bank transaction entries
-- These are entries created from cleared bank transactions that are now being uncleared
-- Only allow deletion of entries with reference_type = 'bank_transaction'

CREATE POLICY "Users can delete orphaned posted bank transaction entries"
    ON journal_entries FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
        AND is_posted = true
        AND reference_type = 'bank_transaction'
    );

-- Also allow deletion of journal entry lines for these orphaned entries
CREATE POLICY "Users can delete lines from orphaned bank transaction entries"
    ON journal_entry_lines FOR DELETE
    USING (
        entry_id IN (
            SELECT id FROM journal_entries 
            WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
            AND is_posted = true
            AND reference_type = 'bank_transaction'
        )
    );
