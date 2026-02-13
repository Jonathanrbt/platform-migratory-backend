import { BaseRepository } from './BaseRepository';
import { Validation, validationSchema } from '../../models/Validation';

export class ValidationSheetsService extends BaseRepository<Validation> {
    constructor() {
        super('Validaciones IA', validationSchema, 'clientId');
    }
}
