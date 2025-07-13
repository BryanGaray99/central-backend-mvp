import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestCasesController } from './controllers/test-cases.controller';
import { TestCasesService } from './services/test-cases.service';
import { TestCase } from './entities/test-case.entity';
import { TestStep } from './entities/test-step.entity';
import { Project } from '../projects/project.entity';
import { StepTemplatesService } from './services/step-templates.service';
import { TestCaseGenerationService } from './services/test-case-generation.service';
import { FeatureFileManagerService } from './services/feature-file-manager.service';
import { StepsFileManagerService } from './services/steps-file-manager.service';
import { TestCaseValidationService } from './services/test-case-validation.service';
import { TestCaseRegistrationService } from './services/test-case-registration.service';
import { FileSystemService } from '../projects/services/file-system.service';
import { TemplateService } from '../projects/services/template.service';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TestCase, TestStep, Project]),
    forwardRef(() => EndpointsModule),
    ProjectsModule,
  ],
  controllers: [TestCasesController],
  providers: [
    TestCasesService,
    StepTemplatesService,
    TestCaseGenerationService,
    FeatureFileManagerService,
    StepsFileManagerService,
    TestCaseValidationService,
    TestCaseRegistrationService,
    FileSystemService,
    TemplateService,
  ],
  exports: [
    TestCasesService,
    StepTemplatesService,
    TestCaseGenerationService,
    FeatureFileManagerService,
    StepsFileManagerService,
    TestCaseValidationService,
    TestCaseRegistrationService,
  ],
})
export class TestCasesModule {} 