import api from './client';

export interface Student {
  id: string;
  nisn: string;
  name: string;
  schoolName: string;
  gender: string;
  foodRestrictions: string | null;
  photoPath: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const studentsApi = {
  getAll: async (params: { page?: number; limit?: number; search?: string }) => {
    const res = await api.get('/students', { params });
    return res.data as { data: Student[]; meta: { total: number; page: number; limit: number; totalPages: number } };
  },

  getOne: async (id: string): Promise<Student> => {
    const res = await api.get(`/students/${id}`);
    return res.data;
  },

  create: async (data: Partial<Student>): Promise<Student> => {
    const res = await api.post('/students', data);
    return res.data;
  },

  update: async (id: string, data: Partial<Student>): Promise<Student> => {
    const res = await api.patch(`/students/${id}`, data);
    return res.data;
  },

  getQrCode: async (id: string): Promise<{ qrDataUrl: string }> => {
    const res = await api.get(`/students/${id}/qr`);
    return res.data;
  },
};
