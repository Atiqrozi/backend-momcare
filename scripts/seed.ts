import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { EncryptionService } from '../src/common/crypto/encryption.service';
import { Facility } from '../src/facilities/schemas/facility.schema';
import { PregnancyProfile, PregnancyStatus } from '../src/pregnancy/schemas/pregnancy-profile.schema';
import { AccountStatus, Role, User } from '../src/users/schemas/user.schema';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const facilityModel = app.get<Model<Facility>>(getModelToken(Facility.name));
  const profileModel = app.get<Model<PregnancyProfile>>(getModelToken(PregnancyProfile.name));
  const encryptionService = app.get(EncryptionService);
  const password = process.env.SEED_PASSWORD || await promptForSeedPassword();
  if (!password || password.length < 8) {
    throw new Error('SEED_PASSWORD minimal 8 karakter wajib diisi');
  }

  const facility = await facilityModel.findOneAndUpdate(
    { code: 'demo-faskes' },
    { $set: { name: 'Faskes Demo MOMENT', address: 'Data sintetis untuk pengujian', active: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all([
    upsertUser(userModel, encryptionService, 'admin.demo@moment.local', 'Admin Demo', Role.ADMIN, passwordHash, facility._id),
    upsertUser(userModel, encryptionService, 'doctor.demo@moment.local', 'Dokter Demo', Role.DOCTOR, passwordHash, facility._id),
    upsertUser(userModel, encryptionService, 'midwife.demo@moment.local', 'Bidan Demo', Role.MIDWIFE, passwordHash, facility._id),
    upsertUser(userModel, encryptionService, 'mother.demo@moment.local', 'Ibu Demo', Role.PREGNANT_MOTHER, passwordHash, facility._id),
  ]);
  const mother = users[3];
  const doctor = users[1];
  const midwife = users[2];
  await profileModel.findOneAndUpdate(
    { userId: mother._id },
    {
      $set: {
        nikEncrypted: encryptionService.encrypt('3276012345678901'),
        insuranceType: 'BPJS',
        bpjsNumber: '0001234567890',
        birthplace: 'Bandung',
        birthDate: new Date('1998-06-15T00:00:00.000Z'),
        education: 'SMA',
        occupation: 'Wiraswasta',
        address: 'Alamat sintetis untuk pengujian, Kota Bandung',
        bloodType: 'O+',
        medicalHistory: 'Data sintetis untuk pengujian; tidak ada riwayat khusus.',
        lmpDate: new Date('2026-04-10T00:00:00.000Z'),
        estimatedDueDate: new Date('2027-01-15T00:00:00.000Z'),
        pregnancyStatus: PregnancyStatus.ONGOING,
        facilityId: facility._id,
        assignedProviderIds: [doctor._id, midwife._id],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  console.log(JSON.stringify({
    facilityCode: 'demo-faskes',
    users: ['admin.demo@moment.local', 'doctor.demo@moment.local', 'midwife.demo@moment.local', 'mother.demo@moment.local'],
  }, null, 2));
  await app.close();
}

async function promptForSeedPassword(): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await terminal.question('Masukkan password untuk semua akun demo: ')).trim();
  } finally {
    terminal.close();
  }
}

async function upsertUser(
  model: Model<User>,
  encryptionService: EncryptionService,
  email: string,
  fullName: string,
  role: Role,
  passwordHash: string,
  facilityId: unknown,
) {
  return model.findOneAndUpdate(
    { email },
    {
      $set: {
        fullNameEncrypted: encryptionService.encrypt(fullName),
        passwordHash,
        role,
        status: AccountStatus.ACTIVE,
        facilityId,
        emailVerified: true,
        phoneVerified: true,
        phone: role === Role.PREGNANT_MOTHER ? '6281234567890' : undefined,
        consentGranted: role === Role.PREGNANT_MOTHER,
        consentGrantedAt: role === Role.PREGNANT_MOTHER ? new Date() : undefined,
      },
      $unset: { fullName: 1, legacyFullName: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

void seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
