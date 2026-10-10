import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScanAttendanceDto } from './dto/scan-attendance.dto';
import { Prisma } from '@prisma/client';
import { toZonedTime, format } from 'date-fns-tz';

const TIMEZONE = 'Asia/Jakarta';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async scan(dto: ScanAttendanceDto, staffId: string) {
    const { qrToken } = dto;

    // 1. Cari siswa berdasarkan QR token
    const student = await this.prisma.student.findUnique({
      where: { qrToken },
      select: {
        id: true,
        nisn: true,
        name: true,
        schoolName: true,
        gender: true,
        foodRestrictions: true,
        photoPath: true,
        isActive: true,
      },
    });

    if (!student) {
      throw new NotFoundException({
        status: 'invalid_qr',
        message: 'QR Code tidak valid atau siswa tidak ditemukan',
      });
    }

    if (!student.isActive) {
      throw new ForbiddenException({
        status: 'inactive_student',
        message: 'Siswa tidak aktif',
        student: {
          name: student.name,
          nisn: student.nisn,
          schoolName: student.schoolName,
        },
      });
    }

    // 2. Hitung tanggal absensi dalam timezone Jakarta
    const nowUtc = new Date();
    const nowJakarta = toZonedTime(nowUtc, TIMEZONE);
    const attendanceDateStr = format(nowJakarta, 'yyyy-MM-dd', { timeZone: TIMEZONE });
    // Simpan sebagai midnight UTC untuk kolom Date
    const attendanceDate = new Date(`${attendanceDateStr}T00:00:00.000Z`);

    // 3. Coba buat attendance record — biarkan DB unique constraint yang mencegah duplikasi
    try {
      const attendance = await this.prisma.attendance.create({
        data: {
          studentId: student.id,
          staffId,
          attendanceDate,
          scannedAt: nowUtc,
          status: 'HADIR',
        },
      });

      return {
        status: 'recorded',
        message: 'Absensi berhasil dicatat',
        student: this.formatStudent(student),
        attendance: {
          date: attendanceDateStr,
          time: nowJakarta.toISOString().replace('Z', '+07:00'),
          id: attendance.id,
        },
      };
    } catch (error) {
      // Unique constraint violation — siswa sudah absen hari ini
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Ambil data attendance yang sudah ada
        const existing = await this.prisma.attendance.findFirst({
          where: { studentId: student.id, attendanceDate },
          select: { scannedAt: true },
        });

        const existingTimeJakarta = existing
          ? toZonedTime(existing.scannedAt, TIMEZONE)
          : nowJakarta;

        return {
          status: 'already_present',
          message: 'Siswa sudah melakukan absensi hari ini',
          student: {
            name: student.name,
            nisn: student.nisn,
            schoolName: student.schoolName,
          },
          attendance: {
            date: attendanceDateStr,
            time: existingTimeJakarta.toISOString().replace('Z', '+07:00'),
          },
        };
      }

      throw error;
    }
  }

  async findAll(
    page = 1,
    limit = 20,
    dateStr?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = {};

    if (dateStr) {
      const date = new Date(`${dateStr}T00:00:00.000Z`);
      where.attendanceDate = date;
    }

    if (search) {
      where.student = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { nisn: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ attendanceDate: 'desc' }, { scannedAt: 'desc' }],
        include: {
          student: {
            select: {
              nisn: true,
              name: true,
              schoolName: true,
              gender: true,
              foodRestrictions: true,
              photoPath: true,
            },
          },
          staff: {
            select: { name: true, username: true },
          },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    const formattedRecords = records.map((r: any) => ({
      id: r.id,
      attendanceDate: format(
        toZonedTime(r.attendanceDate, TIMEZONE),
        'yyyy-MM-dd',
        { timeZone: TIMEZONE },
      ),
      scannedAt: toZonedTime(r.scannedAt, TIMEZONE)
        .toISOString()
        .replace('Z', '+07:00'),
      status: r.status,
      student: r.student,
      scannedBy: r.staff,
    }));

    return {
      data: formattedRecords,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            nisn: true,
            name: true,
            schoolName: true,
            gender: true,
            foodRestrictions: true,
            photoPath: true,
          },
        },
        staff: { select: { name: true, username: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Data absensi tidak ditemukan`);
    }

    const jakartaDate = toZonedTime(record.attendanceDate, TIMEZONE);
    const jakartaScanned = toZonedTime(record.scannedAt, TIMEZONE);

    return {
      id: record.id,
      attendanceDate: format(jakartaDate, 'yyyy-MM-dd', { timeZone: TIMEZONE }),
      scannedAt: jakartaScanned.toISOString().replace('Z', '+07:00'),
      status: record.status,
      student: record.student,
      scannedBy: record.staff,
    };
  }

  private formatStudent(student: {
    name: string;
    nisn: string;
    schoolName: string;
    gender: string;
    foodRestrictions: string | null;
    photoPath: string | null;
  }) {
    return {
      name: student.name,
      nisn: student.nisn,
      schoolName: student.schoolName,
      gender: student.gender === 'LAKI_LAKI' ? 'Laki-laki' : 'Perempuan',
      foodRestrictions: student.foodRestrictions,
      photoUrl: student.photoPath
        ? `${process.env.BACKEND_URL || 'http://localhost:3000'}${student.photoPath}`
        : null,
    };
  }
}
