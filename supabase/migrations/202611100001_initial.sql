create extension if not exists pgcrypto;

create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username)),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  nisn text not null unique check (nisn ~ '^\d{10}$'),
  name text not null,
  school_name text not null,
  gender text not null check (gender in ('LAKI_LAKI', 'PEREMPUAN')),
  food_restrictions text,
  qr_token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.beneficiaries_3b (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nik text not null unique check (nik ~ '^\d{16}$'),
  street text not null,
  rt text not null,
  rw text not null,
  kelurahan text not null,
  kecamatan text not null,
  city text not null,
  province text not null,
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  food_restrictions text,
  decile integer not null check (decile between 1 and 10),
  qr_token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  beneficiary_3b_id uuid references public.beneficiaries_3b(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id),
  attendance_date date not null default ((now() at time zone 'Asia/Jakarta')::date),
  scanned_at timestamptz not null default now(),
  status text not null default 'HADIR' check (status = 'HADIR'),
  constraint attendance_has_one_recipient check (
    (student_id is not null)::integer + (beneficiary_3b_id is not null)::integer = 1
  )
);

create unique index attendances_student_day_key
  on public.attendances(student_id, attendance_date)
  where student_id is not null;
create unique index attendances_beneficiary_day_key
  on public.attendances(beneficiary_3b_id, attendance_date)
  where beneficiary_3b_id is not null;
create index attendances_date_idx on public.attendances(attendance_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger beneficiaries_set_updated_at
before update on public.beneficiaries_3b
for each row execute function public.set_updated_at();

create or replace function public.create_staff_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_username text;
begin
  derived_username := lower(coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(new.email, new.id::text), '@', 1)
  ));

  insert into public.staff_profiles (id, username, name)
  values (
    new.id,
    derived_username,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), derived_username)
  );
  return new;
end;
$$;

create trigger auth_user_created
after insert on auth.users
for each row execute function public.create_staff_profile();

alter table public.staff_profiles enable row level security;
alter table public.students enable row level security;
alter table public.beneficiaries_3b enable row level security;
alter table public.attendances enable row level security;

revoke all on public.staff_profiles, public.students, public.beneficiaries_3b, public.attendances from anon;
grant select on public.staff_profiles to authenticated;
grant select, insert, update, delete on public.students, public.beneficiaries_3b to authenticated;
grant select on public.attendances to authenticated;

create policy "staff can read profiles"
on public.staff_profiles for select to authenticated
using (true);

create policy "active staff can read students"
on public.students for select to authenticated
using (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active));
create policy "active staff can add students"
on public.students for insert to authenticated
with check (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active));
create policy "active staff can edit students"
on public.students for update to authenticated
using (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active))
with check (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active));
create policy "active staff can delete students"
on public.students for delete to authenticated
using (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active));

create policy "active staff can read beneficiaries"
on public.beneficiaries_3b for select to authenticated
using (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active));
create policy "active staff can add beneficiaries"
on public.beneficiaries_3b for insert to authenticated
with check (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active));
create policy "active staff can edit beneficiaries"
on public.beneficiaries_3b for update to authenticated
using (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active))
with check (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active));
create policy "active staff can delete beneficiaries"
on public.beneficiaries_3b for delete to authenticated
using (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active));

create policy "active staff can read attendance"
on public.attendances for select to authenticated
using (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.is_active));

create or replace function public.scan_attendance(p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_staff public.staff_profiles;
  found_student public.students;
  found_beneficiary public.beneficiaries_3b;
  attendance_row public.attendances;
  today_wib date := (now() at time zone 'Asia/Jakarta')::date;
  recipient_json jsonb;
begin
  select * into current_staff from public.staff_profiles
  where id = auth.uid() and is_active;
  if not found then raise exception 'Unauthorized' using errcode = '42501'; end if;

  select * into found_student from public.students where qr_token::text = trim(p_qr_token);
  if found then
    recipient_json := jsonb_build_object(
      'type', 'STUDENT', 'name', found_student.name, 'identifier', found_student.nisn,
      'schoolName', found_student.school_name, 'gender', found_student.gender,
      'foodRestrictions', found_student.food_restrictions, 'photoUrl', null
    );
    if not found_student.is_active then
      return jsonb_build_object('status', 'inactive_student', 'message', 'Penerima manfaat tidak aktif', 'recipient', recipient_json);
    end if;

    select * into attendance_row from public.attendances
    where student_id = found_student.id and attendance_date = today_wib;
    if found then
      return jsonb_build_object('status', 'already_present', 'message', 'Kehadiran sudah dicatat hari ini', 'recipient', recipient_json,
        'attendance', jsonb_build_object('id', attendance_row.id, 'date', attendance_row.attendance_date, 'time', attendance_row.scanned_at));
    end if;

    begin
      insert into public.attendances(student_id, staff_id, attendance_date)
      values (found_student.id, current_staff.id, today_wib) returning * into attendance_row;
    exception when unique_violation then
      select * into attendance_row from public.attendances where student_id = found_student.id and attendance_date = today_wib;
      return jsonb_build_object('status', 'already_present', 'message', 'Kehadiran sudah dicatat hari ini', 'recipient', recipient_json,
        'attendance', jsonb_build_object('id', attendance_row.id, 'date', attendance_row.attendance_date, 'time', attendance_row.scanned_at));
    end;
  else
    select * into found_beneficiary from public.beneficiaries_3b where qr_token::text = trim(p_qr_token);
    if not found then return jsonb_build_object('status', 'invalid_qr', 'message', 'Kode QR tidak valid'); end if;

    recipient_json := jsonb_build_object(
      'type', 'THREE_B_ELDERLY', 'name', found_beneficiary.name, 'identifier', found_beneficiary.nik,
      'address', concat_ws(', ', found_beneficiary.street, 'RT ' || found_beneficiary.rt || '/RW ' || found_beneficiary.rw,
        found_beneficiary.kelurahan, found_beneficiary.kecamatan, found_beneficiary.city, found_beneficiary.province || ' ' || found_beneficiary.postal_code),
      'decile', found_beneficiary.decile, 'foodRestrictions', found_beneficiary.food_restrictions, 'photoUrl', null
    );
    if not found_beneficiary.is_active then
      return jsonb_build_object('status', 'inactive_beneficiary', 'message', 'Penerima manfaat tidak aktif', 'recipient', recipient_json);
    end if;

    select * into attendance_row from public.attendances
    where beneficiary_3b_id = found_beneficiary.id and attendance_date = today_wib;
    if found then
      return jsonb_build_object('status', 'already_present', 'message', 'Kehadiran sudah dicatat hari ini', 'recipient', recipient_json,
        'attendance', jsonb_build_object('id', attendance_row.id, 'date', attendance_row.attendance_date, 'time', attendance_row.scanned_at));
    end if;

    begin
      insert into public.attendances(beneficiary_3b_id, staff_id, attendance_date)
      values (found_beneficiary.id, current_staff.id, today_wib) returning * into attendance_row;
    exception when unique_violation then
      select * into attendance_row from public.attendances where beneficiary_3b_id = found_beneficiary.id and attendance_date = today_wib;
      return jsonb_build_object('status', 'already_present', 'message', 'Kehadiran sudah dicatat hari ini', 'recipient', recipient_json,
        'attendance', jsonb_build_object('id', attendance_row.id, 'date', attendance_row.attendance_date, 'time', attendance_row.scanned_at));
    end;
  end if;

  return jsonb_build_object('status', 'recorded', 'message', 'Kehadiran berhasil dicatat', 'recipient', recipient_json,
    'attendance', jsonb_build_object('id', attendance_row.id, 'date', attendance_row.attendance_date, 'time', attendance_row.scanned_at));
end;
$$;

create or replace function public.list_attendance(
  p_page integer default 1,
  p_limit integer default 20,
  p_date date default null,
  p_search text default null,
  p_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result_data jsonb;
  result_total integer;
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  if not exists (select 1 from public.staff_profiles where id = auth.uid() and is_active) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  with records as (
    select a.*, p.name as staff_name, p.username,
      case when a.student_id is not null then 'STUDENT' else 'THREE_B_ELDERLY' end as recipient_type,
      coalesce(s.name, b.name) as recipient_name,
      coalesce(s.nisn, b.nik) as identifier,
      s.school_name, s.gender, b.decile,
      coalesce(s.food_restrictions, b.food_restrictions) as food_restrictions,
      case when b.id is null then null else concat_ws(', ', b.street, 'RT ' || b.rt || '/RW ' || b.rw, b.kelurahan, b.kecamatan, b.city, b.province || ' ' || b.postal_code) end as address
    from public.attendances a
    join public.staff_profiles p on p.id = a.staff_id
    left join public.students s on s.id = a.student_id
    left join public.beneficiaries_3b b on b.id = a.beneficiary_3b_id
    where (p_date is null or a.attendance_date = p_date)
      and (p_type is null or (p_type = 'STUDENT' and a.student_id is not null) or (p_type = 'THREE_B_ELDERLY' and a.beneficiary_3b_id is not null))
      and (nullif(trim(p_search), '') is null or coalesce(s.name, b.name) ilike '%' || trim(p_search) || '%' or coalesce(s.nisn, b.nik) ilike '%' || trim(p_search) || '%')
  ), counted as (select count(*)::integer as total from records), paged as (
    select * from records order by scanned_at desc offset (safe_page - 1) * safe_limit limit safe_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'attendanceDate', attendance_date, 'scannedAt', scanned_at, 'status', status,
      'recipient', jsonb_build_object('type', recipient_type, 'name', recipient_name, 'identifier', identifier,
        'schoolName', school_name, 'gender', gender, 'address', address, 'decile', decile,
        'foodRestrictions', food_restrictions, 'photoUrl', null),
      'student', null, 'scannedBy', jsonb_build_object('name', staff_name, 'username', username)
    )), '[]'::jsonb), (select total from counted)
  into result_data, result_total from paged;

  return jsonb_build_object('data', result_data, 'meta', jsonb_build_object(
    'total', coalesce(result_total, 0), 'page', safe_page, 'limit', safe_limit,
    'totalPages', greatest(ceil(coalesce(result_total, 0)::numeric / safe_limit)::integer, 1)
  ));
end;
$$;

revoke all on function public.scan_attendance(text) from public, anon;
revoke all on function public.list_attendance(integer, integer, date, text, text) from public, anon;
grant execute on function public.scan_attendance(text) to authenticated;
grant execute on function public.list_attendance(integer, integer, date, text, text) to authenticated;
