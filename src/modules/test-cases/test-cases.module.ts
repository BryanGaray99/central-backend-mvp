import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestCasesController } from './controllers/test-cases.controller';
import { TestCasesService } from './services/test-cases.service';
import { TestCase } from './entities/test-case.entity';
import { TestStep } from './entities/test-step.entity';
import { StepTemplatesService } from './services/step-templates.service';
import { StepsFileManagerService } from './services/steps-file-manager.service';
import { FeatureFileManagerService } from './services/feature-file-manager.service';
import { TestCaseValidationService } from './services/test-case-validation.service';
import { TestCaseGenerationService } from './services/test-case-generation.service';
import { TestCaseRegistrationService } from './services/test-case-registration.service';
import { Project } from '../projects/project.entity';

// AI Services
import { AITestGeneratorService } from './services/ai/ai-test-generator.service';
import { OllamaService } from './services/ai/ollama.service';
import { TSMorphService } from './services/code-manipulation/ts-morph.service';
import { AIFileManagerService } from './services/ai/ai-file-manager.service';
import { AIProjectValidatorService } from './services/ai/ai-project-validator.service';

// Controllers
import { AITestGenerationController } from './controllers/ai-test-generation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TestCase, TestStep, Project]),
  ],
  controllers: [TestCasesController, AITestGenerationController],
  providers: [
    TestCasesService,
    StepTemplatesService,
    StepsFileManagerService,
    FeatureFileManagerService,
    TestCaseValidationService,
    TestCaseGenerationService,
    TestCaseRegistrationService,
    // AI Services
    AITestGeneratorService,
    OllamaService,
    TSMorphService,
    AIFileManagerService,
    AIProjectValidatorService,
  ],
  exports: [
    TestCasesService,
    StepTemplatesService,
    StepsFileManagerService,
    FeatureFileManagerService,
    TestCaseValidationService,
    TestCaseGenerationService,
    TestCaseRegistrationService,
    // AI Services
    AITestGeneratorService,
    OllamaService,
    TSMorphService,
    AIFileManagerService,
    AIProjectValidatorService,
  ],
})
export class TestCasesModule {} 