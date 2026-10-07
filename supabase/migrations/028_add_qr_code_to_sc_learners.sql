-- Migration 028: Add qr_code column and index to sc_learners table

ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Create index on qr_code for high-speed scanning and attendance lookup
CREATE INDEX IF NOT EXISTS sc_learners_qr_code_idx ON public.sc_learners(qr_code) WHERE qr_code IS NOT NULL AND qr_code <> '';
