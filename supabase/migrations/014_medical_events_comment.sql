-- Optional free-text note on medical events (vaccine/deworming comments, etc.)
alter table medical_events add column if not exists comment text;
