import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StepFilesManipulationService } from './step-files-manipulation.service';
import { FeatureFilesManipulationService } from './feature-files-manipulation.service';
import { CodeInsertionService } from './code-insertion.service';
import { CodeParsingService } from './code-parsing.service';
import { TestCaseAnalysisService } from './test-case-analysis.service';
import { Project } from '../../../modules/projects/project.entity';

/**
 * Code Manipulation Module
 * 
 * Provides comprehensive code manipulation services for test case generation and management.
 * Handles parsing of AI-generated code, file manipulation for features and steps,
 * code insertion operations, and test case analysis for Playwright projects.
 * 
 * @module CodeManipulationModule
 */
@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  providers: [
    StepFilesManipulationService,
    FeatureFilesManipulationService,
    CodeInsertionService,
    CodeParsingService,
    TestCaseAnalysisService,
  ],
  exports: [
    StepFilesManipulationService,
    FeatureFilesManipulationService,
    CodeInsertionService,
    CodeParsingService,
    TestCaseAnalysisService,
  ],
})
export class CodeManipulationModule {} 