import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { HealthController } from '../src/health/health.controller';

describe('Health API (e2e)', () => {
  it('returns liveness status', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: getConnectionToken(), useValue: { readyState: 1 } }],
    }).compile();
    const controller = module.get(HealthController);
    expect(controller.check().status).toBe('ok');
    await module.close();
  });
});
