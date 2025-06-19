import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus, ProjectType } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { WorkspaceService } from '../workspace/workspace.service';
import { GenerationService } from './generation.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly workspaceService: WorkspaceService,
    private readonly generationService: GenerationService,
  ) {}

  async create(createDto: CreateProjectDto): Promise<Project> {
    const exists = await this.projectRepo.findOne({ where: { name: createDto.name } });
    if (exists) throw new ConflictException('Project name already exists');
    const workspacePath = await this.workspaceService.createWorkspace(createDto.name);
    const project = this.projectRepo.create({
      ...createDto,
      displayName: createDto.displayName || createDto.name,
      status: ProjectStatus.PENDING,
      type: createDto.type || ProjectType.PLAYWRIGHT_BDD,
      path: workspacePath,
    });
    const savedProject = await this.projectRepo.save(project);
    await this.createProjectMetadata(savedProject);
    this.generationService.generateProject(savedProject).catch(error => {
      console.error('Error en la generación asíncrona:', error);
    });
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
    
    // Solo actualizamos los campos permitidos
    if (updateDto.displayName !== undefined) project.displayName = updateDto.displayName;
    if (updateDto.baseUrl !== undefined) project.baseUrl = updateDto.baseUrl;
    if (updateDto.metadata !== undefined) project.metadata = updateDto.metadata;

    const updatedProject = await this.projectRepo.save(project);
    await this.createProjectMetadata(updatedProject);
    return updatedProject;
  }

  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    if (project.path) {
      await this.workspaceService.deleteWorkspace(project.name);
    }
    await this.projectRepo.remove(project);
  }

  private async createProjectMetadata(project: Project): Promise<void> {
    const metadataPath = path.join(project.path, 'project-meta.json');
    const metadata = {
      id: project.id,
      name: project.name,
      displayName: project.displayName,
      baseUrl: project.baseUrl,
      type: project.type,
      status: project.status,
      metadata: project.metadata || {},
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      endpoints: [],
      testCases: [],
      executions: [],
    };
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }
} 