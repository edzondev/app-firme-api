import { Test, TestingModule } from '@nestjs/testing';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';

describe('SosController', () => {
  let controller: SosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SosController],
      providers: [SosService],
    }).compile();

    controller = module.get<SosController>(SosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
