import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as Handlebars from 'handlebars';

@Injectable()
export class TemplateService {
  private readonly templatesPath: string;

  constructor() {
    // NestJS copia los assets al mismo nivel que el código compilado
    this.templatesPath = path.join(__dirname, '..', 'templates');
  }

  async renderTemplate(templateNameOrPath: string, variables: Record<string, any>): Promise<string> {
    const templatePath = path.isAbsolute(templateNameOrPath) || templateNameOrPath.includes('/') || templateNameOrPath.includes('\\')
      ? templateNameOrPath
      : path.join(this.templatesPath, templateNameOrPath);

    const templateSource = await fs.readFile(templatePath, 'utf-8');
    
    const template = Handlebars.compile(templateSource);
    return template(variables);
  }

  async writeRenderedTemplate(
    templateNameOrPath: string,
    targetPath: string,
    variables: Record<string, any>,
  ): Promise<void> {
    const content = await this.renderTemplate(templateNameOrPath, variables);
    await fs.writeFile(targetPath, content);
  }
} 