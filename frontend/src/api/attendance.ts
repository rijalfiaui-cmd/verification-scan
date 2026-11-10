import { supabase } from './supabase';

export type RecipientType = 'STUDENT' | 'THREE_B_ELDERLY';
export interface Recipient {
  type: RecipientType;
  name: string;
  identifier: string;
  schoolName?: string;
  gender?: string;
  address?: string;
  decile?: number;
  foodRestrictions: string | null;
  photoUrl: null;
}

export interface ScanResult {
  recipient?: Recipient;
  status: 'recorded' | 'already_present' | 'invalid_qr' | 'inactive_student' | 'inactive_beneficiary';
  message: string;
  attendance?: { date: string; time: string; id?: string };
}

export interface AttendanceRecord {
  recipient: Recipient;
  id: string;
  attendanceDate: string;
  scannedAt: string;
  status: string;
  student: null;
  scannedBy: { name: string; username: string };
}

export interface AttendanceMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const attendanceApi = {
  scan: async (qrToken: string): Promise<ScanResult> => {
    const { data, error } = await supabase.rpc('scan_attendance', { p_qr_token: qrToken });
    if (error) throw error;
    return data as ScanResult;
  },

  getAll: async (params: {
    page?: number;
    limit?: number;
    date?: string;
    search?: string;
    type?: RecipientType;
  }): Promise<{ data: AttendanceRecord[]; meta: AttendanceMeta }> => {
    const { data, error } = await supabase.rpc('list_attendance', {
      p_page: params.page || 1,
      p_limit: params.limit || 20,
      p_date: params.date || undefined,
      p_search: params.search || undefined,
      p_type: params.type || undefined,
    });
    if (error) throw error;
    return data as { data: AttendanceRecord[]; meta: AttendanceMeta };
  },
};
