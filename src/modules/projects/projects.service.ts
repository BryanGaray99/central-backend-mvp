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

/**
 * Service for managing testing projects.
 * 
 * This service handles the complete lifecycle of testing projects, including
 * creation, validation, workspace management, and project generation.
 * It coordinates with various specialized services to provide comprehensive
 * project management functionality.
 * 
 * @class ProjectsService
 * @since 1.0.0
 */
@Injectable()
export class ProjectsService {
  /**
   * Creates an instance of ProjectsService.
   * 
   * @param projectRepo - TypeORM repository for Project entity
   * @param workspaceService - Service for workspace management
   * @param generationService - Service for project generation
   * @param validationService - Service for input validation
   * @param queueService - Service for project generation queue
   * @param cleanupService - Service for cleanup operations
   */
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly workspaceService: WorkspaceService,
    private readonly generationService: GenerationService,
    private readonly validationService: ValidationService,
    private readonly queueService: QueueService,
    private readonly cleanupService: CleanupService,
  ) {}

  /**
   * Creates a new testing project.
   * 
   * This method validates the input configuration, creates a workspace,
   * saves the project to the database, and queues it for generation.
   * 
   * @param createDto - Project creation data
   * @returns Promise that resolves to the created project
   * @throws {ConflictException} When project name already exists
   * @throws {BadRequestException} When validation fails
   * 
   * @example
   * ```typescript
   * const project = await projectsService.create({
   *   name: 'my-test-project',
   *   baseUrl: 'http://localhost:3000',
   *   displayName: 'My Test Project'
   * });
   * ```
   */
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

  /**
   * Retrieves all projects.
   * 
   * @returns Promise that resolves to an array of all projects
   * 
   * @example
   * ```typescript
   * const projects = await projectsService.findAll();
   * console.log(`Found ${projects.length} projects`);
   * ```
   */
  async findAll(): Promise<Project[]> {
    return this.projectRepo.find();
  }

  /**
   * Retrieves a project by its ID.
   * 
   * @param id - The unique identifier of the project
   * @returns Promise that resolves to the project
   * @throws {NotFoundException} When project is not found
   * 
   * @example
   * ```typescript
   * const project = await projectsService.findOne('project-uuid');
   * console.log(`Project: ${project.name}`);
   * ```
   */
  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  /**
   * Retrieves a project by its name.
   * 
   * @param name - The name of the project
   * @returns Promise that resolves to the project
   * @throws {NotFoundException} When project is not found
   * 
   * @example
   * ```typescript
   * const project = await projectsService.findByName('my-test-project');
   * console.log(`Project ID: ${project.id}`);
   * ```
   */
  async findByName(name: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { name } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  /**
   * Updates an existing project.
   * 
   * @param id - The unique identifier of the project to update
   * @param updateDto - Project update data
   * @returns Promise that resolves to the updated project
   * @throws {NotFoundException} When project is not found
   * 
   * @example
   * ```typescript
   * const updatedProject = await projectsService.update('project-uuid', {
   *   displayName: 'Updated Project Name',
   *   baseUrl: 'http://new-url:3000'
   * });
   * ```
   */
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

  /**
   * Removes a project and cleans up associated resources.
   * 
   * This method deletes the project from the database and removes
   * the associated workspace directory.
   * 
   * @param id - The unique identifier of the project to remove
   * @returns Promise that resolves when the project is removed
   * @throws {NotFoundException} When project is not found
   * @throws {ConflictException} When workspace cannot be deleted
   * 
   * @example
   * ```typescript
   * await projectsService.remove('project-uuid');
   * console.log('Project removed successfully');
   * ```
   */
  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    if (project.path) {
      await this.workspaceService.deleteWorkspace(project.name);
    }
    await this.projectRepo.remove(project);
  }


}
