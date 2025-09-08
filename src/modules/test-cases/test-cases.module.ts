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

/**
 * Test Cases Module
 *
 * This module provides comprehensive test case management functionality for the API testing system.
 * It handles the creation, management, and execution of test cases and test steps, including
 * AI-powered test generation, feature file management, and integration with Playwright projects.
 *
 * The module includes:
 * - Test case and test step entities for data persistence
 * - Controllers for handling HTTP requests related to test cases
 * - Services for test case generation, registration, and management
 * - Integration with AI services for automated test generation
 * - Feature file management for Playwright test execution
 * - Common hooks registration for database tracking
 *
 * @module TestCasesModule
 * @since 1.0.0
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TestCase, TestStep, Project, AIGeneration, Bug]),
    ProjectsModule, // Import ProjectsModule to access FileSystemService and TemplateService
    forwardRef(() => AIModule), // Import AI Module to access AIAgentService
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