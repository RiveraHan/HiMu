alter table tracks add column source text;
alter table tracks add column external_id text;

create unique index tracks_source_external_id_idx
  on tracks (source, external_id)
  where source is not null;