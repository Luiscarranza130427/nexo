import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the API name and status', () => {
      expect(appController.getInfo()).toEqual({ name: 'Nexo API', status: 'ok' });
    });
  });

  describe('health', () => {
    it('should report a healthy status', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });
  });
});
