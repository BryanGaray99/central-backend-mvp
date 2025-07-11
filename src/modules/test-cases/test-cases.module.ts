import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestCase } from './entities/test-case.entity';
import { TestStep } from './entities/test-step.entity';
import { TestCasesController } from './controllers/test-cases.controller';
import { TestCasesService } from './services/test-cases.service';
import { StepTemplatesService } from './services/step-templates.service';
import { FeatureFileManagerService } from './services/feature-file-manager.service';
import { StepsFileManagerService } from './services/steps-file-manager.service';
import { TestCaseValidationService } from './services/test-case-validation.service';
import { TestCaseGenerationService } from './services/test-case-generation.service';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TestCase, TestStep]),
    forwardRef(() => EndpointsModule),
    ProjectsModule,
  ],
  controllers: [TestCasesController],
  providers: [
    TestCasesService,
    StepTemplatesService,
    FeatureFileManagerService,
    StepsFileManagerService,
    TestCaseValidationService,
    TestCaseGenerationService,
  ],
  exports: [
    TestCasesService,
    StepTemplatesService,
    FeatureFileManagerService,
    StepsFileManagerService,
    TestCaseValidationService,
    TestCaseGenerationService,
  ],
})
export class TestCasesModule {} 