-- Normalize legacy processedLabel values to Real-Estate (single source of truth for IMAP + Gmail).
UPDATE "MailAccount"
SET
  "rules" = jsonb_set(
    COALESCE("rules", '{}'::jsonb),
    '{processedLabel}',
    to_jsonb('Real-Estate'::text),
    true
  )
WHERE
  ("rules"->>'processedLabel') IN ('Crescent/Processed', 'Crescent-Processed');
