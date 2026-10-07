-- 0002 · Integridad de las cuentas.

-- Presupuesto de XP por cuenta: una franquicia que se gasta y se recarga con el tiempo. Antes cada
-- sincronización estrenaba una franquicia nueva, así que bastaba sincronizar muchas veces para subir sin jugar.
alter table players add column if not exists xp_budget double precision not null default 400;
alter table players add column if not exists budget_at timestamptz not null default now();

-- Orden estable para exportar por páginas.
create index if not exists players_export_idx on players (created_at asc, id asc);

-- Un dato de contacto solo se guarda con el curso informado y, en 7° y 8° básico, con la autorización
-- del apoderado. La regla se revisa en la base cada vez que cambian el curso, el contacto o la
-- autorización, de modo que dos cambios simultáneos no puedan dejar una fila que la incumpla.
-- Las filas anteriores no se tocan: su contacto queda retenido en la exportación hasta que una
-- persona decida (ver docs/PRODUCCION.md), y siguen pudiendo sincronizar su progreso.
create or replace function players_contact_policy() returns trigger language plpgsql as $policy$
begin
  if new.contact_value is not null and (new.grade is null or (new.grade in ('7b', '8b') and not new.guardian_consent)) then
    raise exception 'contact_policy: el contacto requiere curso y, en 7b/8b, autorización del apoderado' using errcode = '23514';
  end if;
  return new;
end;
$policy$;

drop trigger if exists players_contact_policy on players;
create trigger players_contact_policy
  before insert or update of grade, contact_value, contact_consent, guardian_consent on players
  for each row execute function players_contact_policy();
