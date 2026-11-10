import { supabase } from './supabase';

export interface LoginResponse {
  accessToken: string;
  staff: {
    id: string;
    username: string;
    name: string;
  };
}

export interface StaffMe {
  id: string;
  username: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

interface StaffRow {
  id: string;
  username: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

const staffEmail = (username: string) => `${username.trim().toLowerCase()}@absenqr.local`;

const mapStaff = (row: StaffRow): StaffMe => ({
  id: row.id,
  username: row.username,
  name: row.name,
  isActive: row.is_active,
  createdAt: row.created_at,
});

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: staffEmail(username),
      password,
    });
    if (error || !data.session) throw new Error('Username atau password salah.');

    const staff = await authApi.getMe();
    if (!staff.isActive) {
      await supabase.auth.signOut();
      throw new Error('Akun petugas tidak aktif.');
    }

    return {
      accessToken: data.session.access_token,
      staff: { id: staff.id, username: staff.username, name: staff.name },
    };
  },

  getMe: async (): Promise<StaffMe> => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('Sesi tidak valid.');

    const { data, error } = await supabase
      .from('staff_profiles')
      .select('id, username, name, is_active, created_at')
      .eq('id', userData.user.id)
      .single();
    if (error || !data) throw new Error('Profil petugas tidak ditemukan.');
    return mapStaff(data as StaffRow);
  },
};
