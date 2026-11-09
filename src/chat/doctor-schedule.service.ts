import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';

export type DoctorWorkWindow = {
  doctorName: string;
  weekday: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
};

@Injectable()
export class DoctorScheduleService {
  private accessToken?: string;
  private accessTokenExpiresAt = 0;
  private cachedRows?: string[][];
  private cachedAt = 0;

  constructor(private readonly config: ConfigService) {}

  async getDoctorWindows(doctorName: string, weekday: string): Promise<DoctorWorkWindow[]> {
    const rows = await this.readRows();
    if (!rows.length) return [];
    const header = rows[0].map((value) => this.normalizeHeader(value));
    const doctorIndex = header.indexOf('dokter');
    const weekdayIndex = header.indexOf('hari');
    const startIndex = header.indexOf('jammulai');
    const endIndex = header.indexOf('jamselesai');
    const durationIndex = header.findIndex((value) => value === 'durasikonsultasimenit' || value === 'durasimenit');
    if ([doctorIndex, weekdayIndex, startIndex, endIndex].some((index) => index < 0)) {
      throw new ServiceUnavailableException('Header jadwal pada Sheet1 harus berisi Dokter, Hari, Jam Mulai, dan Jam Selesai.');
    }

    const doctorKey = this.normalizeDoctor(doctorName);
    const weekdayKey = this.normalizeDay(weekday);
    return rows.slice(1).flatMap((row) => {
      const rowDoctor = this.normalizeDoctor(row[doctorIndex] ?? '');
      const rowDay = this.normalizeDay(row[weekdayIndex] ?? '');
      if (!rowDoctor || rowDoctor !== doctorKey || rowDay !== weekdayKey) return [];
      const startTime = this.readTime(row[startIndex]);
      const endTime = this.readTime(row[endIndex]);
      if (!startTime || !endTime || this.minutesOfDay(endTime) <= this.minutesOfDay(startTime)) return [];
      const durationValue = durationIndex >= 0 ? Number(row[durationIndex]) : 15;
      const durationMinutes = Number.isFinite(durationValue) ? Math.min(15, Math.max(10, durationValue)) : 15;
      return [{ doctorName: String(row[doctorIndex]).trim(), weekday: weekdayKey, startTime, endTime, durationMinutes }];
    });
  }

  private async readRows(): Promise<string[][]> {
    if (this.cachedRows && Date.now() - this.cachedAt < 60_000) return this.cachedRows;
    const spreadsheetId = this.config.get<string>('googleSheets.spreadsheetId');
    const tab = this.config.get<string>('googleSheets.scheduleTab', 'Sheet1');
    if (!spreadsheetId) throw new ServiceUnavailableException('GOOGLE_SHEETS_SPREADSHEET_ID belum dikonfigurasi.');
    const token = await this.getAccessToken();
    const range = `${tab}!A:Z`;
    const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
    let response: Response;
    try {
      response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new ServiceUnavailableException('Google Sheets tidak dapat dijangkau. Coba kembali beberapa saat lagi.');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Jadwal Google Sheets tidak dapat dibaca. Periksa akses service account ke spreadsheet.');
    }
    const result = await response.json() as { values?: unknown[][] };
    this.cachedRows = (result.values ?? []).map((row) => row.map((cell) => String(cell ?? '').trim()));
    this.cachedAt = Date.now();
    return this.cachedRows;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - 60_000) return this.accessToken;
    const email = this.config.get<string>('googleSheets.serviceAccountEmail');
    const privateKey = this.config.get<string>('googleSheets.privateKey')?.replace(/\\n/g, '\n');
    if (!email || !privateKey) {
      throw new ServiceUnavailableException('Kredensial Google service account belum dikonfigurasi di backend.');
    }
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    const assertion = `${unsigned}.${signer.sign(privateKey, 'base64url')}`;
    let response: Response;
    try {
      response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException('Layanan autentikasi Google tidak dapat dijangkau.');
    }
    const payload = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
    if (!response.ok || !payload?.access_token) {
      throw new ServiceUnavailableException('Autentikasi Google gagal. Periksa kredensial service account backend.');
    }
    this.accessToken = payload.access_token;
    this.accessTokenExpiresAt = Date.now() + (payload.expires_in ?? 3600) * 1000;
    return this.accessToken;
  }

  private normalizeHeader(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private normalizeDoctor(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^dokter/, '').replace(/^dr/, '').replace(/spog/g, '');
  }

  private normalizeDay(value: string) {
    const key = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const days: Record<string, string> = {
      senin: 'senin', monday: 'senin',
      selasa: 'selasa', tuesday: 'selasa',
      rabu: 'rabu', wednesday: 'rabu',
      kamis: 'kamis', thursday: 'kamis',
      jumat: 'jumat', friday: 'jumat',
      sabtu: 'sabtu', saturday: 'sabtu',
      minggu: 'minggu', ahad: 'minggu', sunday: 'minggu',
    };
    return days[key] ?? key;
  }

  private readTime(value: string | undefined) {
    const text = String(value ?? '').trim();
    const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return '';
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return '';
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private minutesOfDay(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
