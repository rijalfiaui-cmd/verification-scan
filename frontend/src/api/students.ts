import { supabase } from './supabase';

export interface Student {
  id: string;
  nisn: string;
  name: string;
  schoolName: string;
  gender: 'LAKI_LAKI' | 'PEREMPUAN' | string;
  foodRestrictions: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  qrToken: string;
}

export interface CreateStudentPayload {
  nisn: string;
  name: string;
  schoolName: string;
  gender: 'LAKI_LAKI' | 'PEREMPUAN';
  foodRestrictions?: string;
  isActive?: boolean;
}

interface StudentRow {
  id: string;
  nisn: string;
  name: string;
  school_name: string;
  gender: string;
  food_restrictions: string | null;
  qr_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const mapStudent = (row: StudentRow): Student => ({
  id: row.id,
  nisn: row.nisn,
  name: row.name,
  schoolName: row.school_name,
  gender: row.gender,
  foodRestrictions: row.food_restrictions,
  qrToken: row.qr_token,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toRow = (data: Partial<CreateStudentPayload>) => ({
  ...(data.nisn !== undefined && { nisn: data.nisn }),
  ...(data.name !== undefined && { name: data.name }),
  ...(data.schoolName !== undefined && { school_name: data.schoolName }),
  ...(data.gender !== undefined && { gender: data.gender }),
  ...(data.foodRestrictions !== undefined && { food_restrictions: data.foodRestrictions || null }),
  ...(data.isActive !== undefined && { is_active: data.isActive }),
});

export const studentsApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string }) => {
    const page = Math.max(params?.page || 1, 1);
    const limit = Math.min(Math.max(params?.limit || 20, 1), 100);
    const from = (page - 1) * limit;
    let query = supabase.from('students').select('*', { count: 'exact' });
    if (params?.search?.trim()) {
      const term = params.search.trim().replace(/[,%().]/g, '');
      query = query.or(`name.ilike.%${term}%,nisn.ilike.%${term}%,school_name.ilike.%${term}%`);
    }
    const { data, error, count } = await query.order('name').range(from, from + limit - 1);
    if (error) throw error;
    const total = count || 0;
    return {
      data: (data as StudentRow[]).map(mapStudent),
      meta: { total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) },
    };
  },

  getOne: async (id: string): Promise<Student> => {
    const { data, error } = await supabase.from('students').select('*').eq('id', id).single();
    if (error) throw error;
    return mapStudent(data as StudentRow);
  },

  create: async (data: CreateStudentPayload): Promise<Student> => {
    const { data: created, error } = await supabase.from('students').insert(toRow(data)).select().single();
    if (error) throw error;
    return mapStudent(created as StudentRow);
  },

  update: async (id: string, data: Partial<CreateStudentPayload>): Promise<Student> => {
    const { data: updated, error } = await supabase.from('students').update(toRow(data)).eq('id', id).select().single();
    if (error) throw error;
    return mapStudent(updated as StudentRow);
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
  },

  getQrCode: async (id: string): Promise<{ qrToken: string }> => {
    const { data, error } = await supabase.from('students').select('qr_token').eq('id', id).single();
    if (error) throw error;
    return { qrToken: data.qr_token as string };
  },
};
