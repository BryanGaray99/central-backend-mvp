import { ApiProperty, ApiExtraModels } from '@nestjs/swagger';
import { StepType, StepStatus, StepTemplateType } from '../entities/test-step.entity';

@ApiExtraModels()
export class TestStepListResponseDto {
  @ApiProperty({ description: 'Test step ID' })
  id: string;

  @ApiProperty({ description: 'Unique step identifier' })
  stepId: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Section name' })
  section: string;

  @ApiProperty({ description: 'Entity name' })
  entityName: string;

  @ApiProperty({ description: 'Step name' })
  name: string;

  @ApiProperty({ description: 'Step definition' })
  definition: string;

  @ApiProperty({ description: 'Step type', enum: StepType })
  type: StepType;

  @ApiProperty({ description: 'Step template type', enum: StepTemplateType })
  stepType: StepTemplateType;

  @ApiProperty({ description: 'Step parameters' })
  parameters: any[];

  @ApiProperty({ description: 'Step implementation' })
  implementation: string;

  @ApiProperty({ description: 'Step validation', required: false })
  validation?: any;

  @ApiProperty({ description: 'Step status', enum: StepStatus })
  status: StepStatus;

  @ApiProperty({ description: 'Step metadata', required: false })
  metadata?: any;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
} 