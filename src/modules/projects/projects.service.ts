import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus, ProjectType } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { WorkspaceService } from '../workspace/workspace.service';
import { GenerationService } from './generation.service';
import { ValidationService } from './services/validation.service';
import { QueueService } from './services/queue.service';
import { CleanupService } from './services/cleanup.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly workspaceService: WorkspaceService,
    private readonly generationService: GenerationService,
    private readonly validationService: ValidationService,
    private readonly queueService: QueueService,
    private readonly cleanupService: CleanupService,
  ) {}

  async create(createDto: CreateProjectDto): Promise<Project> {
    // Validate input configuration
    this.validationService.validateProjectConfiguration(createDto);

    const exists = await this.projectRepo.findOne({
      where: { name: createDto.name },
    });
    if (exists) throw new ConflictException('Project name already exists');

    const workspacePath = await this.workspaceService.createWorkspace(
      createDto.name,
    );

    // Validate workspace configuration
    this.validationService.validateWorkspaceConfiguration(workspacePath);

    const project = this.projectRepo.create({
      ...createDto,
      displayName: createDto.displayName || createDto.name,
      basePath: createDto.basePath || '/v1/api',
      status: ProjectStatus.PENDING,
      type: createDto.type || ProjectType.PLAYWRIGHT_BDD,
      path: workspacePath,
    });
    const savedProject = await this.projectRepo.save(project);

    // Add to generation queue instead of executing directly
    try {
      this.queueService.enqueue(savedProject, 1);
    } catch (error) {
      console.error('Error adding project to queue:', error);
    }

    return savedProject;
  }

  async findAll(): Promise<Project[]> {
    return this.projectRepo.find();
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, updateDto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);

    // Only update allowed fields
    if (updateDto.displayName !== undefined)
      project.displayName = updateDto.displayName;
    if (updateDto.baseUrl !== undefined) project.baseUrl = updateDto.baseUrl;
    if (updateDto.basePath !== undefined) project.basePath = updateDto.basePath;

    const updatedProject = await this.projectRepo.save(project);
    return updatedProject;
  }

  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    if (project.path) {
      await this.workspaceService.deleteWorkspace(project.name);
    }
    await this.projectRepo.remove(project);
  }


}
