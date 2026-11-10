import { supabase } from './supabase';

export interface BeneficiaryPayload {
  name: string;
  nik: string;
  street: string;
  rt: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  city: string;
  province: string;
  postalCode: string;
  foodRestrictions: string;
  decile: number;
  isActive: boolean;
}

export interface Beneficiary extends BeneficiaryPayload {
  id: string;
  foodRestrictions: string;
  qrToken: string;
  createdAt: string;
  updatedAt: string;
}

interface BeneficiaryRow {
  id: string;
  name: string;
  nik: string;
  street: string;
  rt: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  city: string;
  province: string;
  postal_code: string;
  food_restrictions: string | null;
  decile: number;
  qr_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const mapBeneficiary = (row: BeneficiaryRow): Beneficiary => ({
  id: row.id,
  name: row.name,
  nik: row.nik,
  street: row.street,
  rt: row.rt,
  rw: row.rw,
  kelurahan: row.kelurahan,
  kecamatan: row.kecamatan,
  city: row.city,
  province: row.province,
  postalCode: row.postal_code,
  foodRestrictions: row.food_restrictions || '',
  decile: row.decile,
  qrToken: row.qr_token,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toRow = (data: BeneficiaryPayload) => ({
  name: data.name,
  nik: data.nik,
  street: data.street,
  rt: data.rt,
  rw: data.rw,
  kelurahan: data.kelurahan,
  kecamatan: data.kecamatan,
  city: data.city,
  province: data.province,
  postal_code: data.postalCode,
  food_restrictions: data.foodRestrictions || null,
  decile: data.decile,
  is_active: data.isActive,
});

export const addressText = (b: BeneficiaryPayload | Beneficiary) =>
  `${b.street}, RT ${b.rt}/RW ${b.rw}, ${b.kelurahan}, ${b.kecamatan}, ${b.city}, ${b.province} ${b.postalCode}`;

export const beneficiariesApi = {
  async getAll(params: { page: number; limit: number; search?: string }, signal?: AbortSignal) {
    const page = Math.max(params.page, 1);
    const limit = Math.min(Math.max(params.limit, 1), 100);
    const from = (page - 1) * limit;
    let query = supabase.from('beneficiaries_3b').select('*', { count: 'exact' });
    if (params.search?.trim()) {
      const term = params.search.trim().replace(/[,%().]/g, '');
      query = query.or(`name.ilike.%${term}%,nik.ilike.%${term}%`);
    }
    const { data, error, count } = await query.abortSignal(signal || new AbortController().signal).order('name').range(from, from + limit - 1);
    if (error) throw error;
    const total = count || 0;
    return { data: (data as BeneficiaryRow[]).map(mapBeneficiary), meta: { total, totalPages: Math.max(Math.ceil(total / limit), 1) } };
  },
  async create(data: BeneficiaryPayload) {
    const { data: created, error } = await supabase.from('beneficiaries_3b').insert(toRow(data)).select().single();
    if (error) throw error;
    return mapBeneficiary(created as BeneficiaryRow);
  },
  async update(id: string, data: BeneficiaryPayload) {
    const { data: updated, error } = await supabase.from('beneficiaries_3b').update(toRow(data)).eq('id', id).select().single();
    if (error) throw error;
    return mapBeneficiary(updated as BeneficiaryRow);
  },
  async delete(id: string) {
    const { error } = await supabase.from('beneficiaries_3b').delete().eq('id', id);
    if (error) throw error;
  },
  async qr(id: string) {
    const { data, error } = await supabase.from('beneficiaries_3b').select('qr_token').eq('id', id).single();
    if (error) throw error;
    return { qrToken: data.qr_token as string };
  },
};
