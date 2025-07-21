import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeAnalysisController } from './controllers/code-analysis.controller';
import { TestCasesController } from './controllers/test-cases.controller';
import { TestCasesService } from './services/test-cases.service';
import { TestCase } from './entities/test-case.entity';
import { TestStep } from './entities/test-step.entity';
import { AIGeneration } from './entities/ai-generation.entity';
import { StepTemplatesService } from './services/step-templates.service';
import { StepsFileManagerService } from './services/steps-file-manager.service';
import { FeatureFileManagerService } from './services/feature-file-manager.service';
import { TestCaseGenerationService } from './services/test-case-generation.service';
import { TestCaseRegistrationService } from './services/test-case-registration.service';
import { Project } from '../projects/project.entity';

// Code Analysis Services
import { TSMorphService } from './services/code-manipulation/ts-morph.service';
import { ProjectsModule } from '../projects/projects.module';

// AI Module
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TestCase, TestStep, Project, AIGeneration]),
    ProjectsModule, // Importar ProjectsModule para acceder a FileSystemService y TemplateService
    AIModule, // Importar AI Module para acceder a AIAgentService
  ],
  controllers: [CodeAnalysisController, TestCasesController], // Agregar TestCasesController
  providers: [
    TestCasesService,
    StepTemplatesService,
    StepsFileManagerService,
    FeatureFileManagerService,
    TestCaseGenerationService,
    TestCaseRegistrationService,
    // Code Analysis Services
    TSMorphService,
  ],
  exports: [
    TestCasesService,
    StepTemplatesService,
    StepsFileManagerService,
    FeatureFileManagerService,
    TestCaseGenerationService,
    TestCaseRegistrationService,
    // Code Analysis Services
    TSMorphService,
  ],
})
export class TestCasesModule {} 