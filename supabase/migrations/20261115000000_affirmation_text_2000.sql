-- Allow longer, multi-paragraph affirmations (was 500).
alter table affirmations drop constraint if exists affirmations_text_check;
alter table affirmations
  add constraint affirmations_text_check check (char_length(text) between 1 and 2000);
