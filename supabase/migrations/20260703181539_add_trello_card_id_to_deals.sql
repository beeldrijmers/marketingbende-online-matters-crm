alter table "public"."deals" add column "trello_card_id" text;

CREATE UNIQUE INDEX uq__deals__trello_card_id ON public.deals USING btree (trello_card_id) WHERE (trello_card_id IS NOT NULL);
