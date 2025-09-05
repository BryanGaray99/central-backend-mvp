import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestCasesController } from './controllers/test-cases.controller';
import { ProjectTestCasesController } from './controllers/project-test-cases.controller';
import { TestCasesService } from './services/test-cases.service';
import { TestCase } from './entities/test-case.entity';
import { TestStep } from './entities/test-step.entity';
import { AIGeneration } from './entities/ai-generation.entity';
import { StepTemplatesService } from './services/step-templates.service';
import { FeatureFileManagerService } from './services/feature-file-manager.service';
import { TestCaseGenerationService } from './services/test-case-generation.service';
import { TestCaseRegistrationService } from './services/test-case-registration.service';
import { TestStepRegistrationService } from './services/test-step-registration.service';
import { CommonHooksRegistrationService } from './services/common-hooks-registration.service';
import { Project } from '../projects/project.entity';
import { ProjectsModule } from '../projects/projects.module';
import { AIModule } from '../ai/ai.module';
import { Bug } from '../bugs/entities/bug.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TestCase, TestStep, Project, AIGeneration, Bug]),
    ProjectsModule, // Importar ProjectsModule para acceder a FileSystemService y TemplateService
    forwardRef(() => AIModule), // Importar AI Module para acceder a AIAgentService
  ],
  controllers: [TestCasesController, ProjectTestCasesController],
  providers: [
    TestCasesService,
    StepTemplatesService,
    FeatureFileManagerService,
    TestCaseGenerationService,
    TestCaseRegistrationService,
    TestStepRegistrationService,
    CommonHooksRegistrationService,
  ],
  exports: [
    TestCasesService,
    StepTemplatesService,
    FeatureFileManagerService,
    TestCaseGenerationService,
    TestCaseRegistrationService,
    TestStepRegistrationService,
    CommonHooksRegistrationService,
  ],
})
export class TestCasesModule {} 