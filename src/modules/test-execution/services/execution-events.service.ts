import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';

export interface ExecutionEvent {
  executionId: string;
  type: 'started' | 'progress' | 'completed' | 'failed';
  status: string;
  progress?: number;
  message?: string;
  timestamp: string;
  projectId: string;
  entityName?: string;
  testSuiteId?: string;
  results?: any;
}

@Injectable()
export class ExecutionEventsService {
  private readonly logger = new Logger(ExecutionEventsService.name);
  private readonly executionEvents = new Subject<ExecutionEvent>();

  /**
   * Emitir evento de ejecución
   */
  emitExecutionEvent(event: ExecutionEvent) {
    this.logger.log(`Emitting execution event: ${event.type} for ${event.executionId}`);
    this.logger.log(`Full event data:`, JSON.stringify(event, null, 2));
    this.executionEvents.next(event);
  }

  /**
   * Obtener stream de eventos para un proyecto específico
   */
  getExecutionEvents(projectId: string): Observable<MessageEvent> {
    return this.executionEvents.asObservable().pipe(
      map(event => {
        // Solo enviar eventos del proyecto específico
        if (event.projectId === projectId) {
          const messageEvent = {
            data: JSON.stringify(event),
          } as MessageEvent;
          this.logger.log(`Sending SSE event to client: ${event.type} for ${event.executionId}`);
          this.logger.log(`Message data: ${messageEvent.data}`);
          return messageEvent;
        }
        return null;
      }),
      filter((event): event is MessageEvent => event !== null)
    );
  }

  /**
   * Emitir evento de inicio de ejecución
   */
  emitExecutionStarted(executionId: string, projectId: string, entityName?: string, testSuiteId?: string) {
    this.emitExecutionEvent({
      executionId,
      type: 'started',
      status: 'running',
      message: `Ejecución iniciada${entityName ? ` para ${entityName}` : ''}`,
      timestamp: new Date().toISOString(),
      projectId,
      entityName,
      testSuiteId,
    });
  }

  /**
   * Emitir evento de progreso
   */
  emitExecutionProgress(executionId: string, projectId: string, progress: number, message?: string) {
    this.emitExecutionEvent({
      executionId,
      type: 'progress',
      status: 'running',
      progress,
      message,
      timestamp: new Date().toISOString(),
      projectId,
    });
  }

  /**
   * Emitir evento de ejecución completada
   */
  emitExecutionCompleted(executionId: string, projectId: string, results: any) {
    this.emitExecutionEvent({
      executionId,
      type: 'completed',
      status: 'completed',
      message: 'Ejecución completada exitosamente',
      timestamp: new Date().toISOString(),
      projectId,
      results,
    });
  }

  /**
   * Emitir evento de ejecución fallida
   */
  emitExecutionFailed(executionId: string, projectId: string, error: string) {
    this.emitExecutionEvent({
      executionId,
      type: 'failed',
      status: 'failed',
      message: `Ejecución fallida: ${error}`,
      timestamp: new Date().toISOString(),
      projectId,
    });
  }
}
