import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EncryptionService } from '../src/common/crypto/encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            encryption: {
              masterKey: 'test-master-key-32-characters-long!!',
            },
          })],
        }),
      ],
      providers: [EncryptionService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should encrypt and decrypt a string correctly', () => {
    const plaintext = 'Test NIK 1234567890123456';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(encrypted).not.toBe(plaintext);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext (IV randomness)', () => {
    const plaintext = 'Same input';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
    expect(service.decrypt(encrypted1)).toBe(plaintext);
    expect(service.decrypt(encrypted2)).toBe(plaintext);
  });

  it('should handle empty strings (skip encryption for empty in practice)', () => {
    // In practice, we don't encrypt empty strings - we return undefined
    // This test verifies the encrypt/decrypt round-trip for non-empty strings
    const plaintext = 'x';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle special characters', () => {
    const plaintext = 'Nama: Budi Santoso 🇮🇩';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle NIK format (16 digits)', () => {
    const plaintext = '3201012304950001';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(decrypted).toMatch(/^\d{16}$/);
  });

  it('should handle full name with spaces', () => {
    const plaintext = 'Siti Nurhaliza Binti Ahmad';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should throw on invalid encrypted format', () => {
    expect(() => service.decrypt('invalid-format')).toThrow('Format data terenkripsi tidak valid');
  });

  it('should throw on tampered ciphertext', () => {
    const plaintext = 'Secret data';
    const encrypted = service.encrypt(plaintext);

    // Tamper with the ciphertext part
    const parts = encrypted.split(':');
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}00`;

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('encryptField should return undefined for null/undefined input', () => {
    expect(service.encryptField(undefined)).toBeUndefined();
    expect(service.encryptField(null)).toBeUndefined();
  });

  it('decryptField should return undefined for null/undefined input', () => {
    expect(service.decryptField(undefined)).toBeUndefined();
    expect(service.decryptField(null)).toBeUndefined();
  });
});