import { AuthService } from './src/services/authService';
import prisma from './src/config/prisma';

async function createLawyer() {
    const authService = new AuthService();
    
    try {
        console.log('Creando usuario abogado...');
        
        const result = await authService.register({
            email: 'abogado@gmail.com',
            password: 'admin123',
            firstName: 'Abogado',
            lastName: 'Sistema',
            role: 'Abogado',
            documentType: 'DNI',
            documentNumber: '12345678'
        });
        
        console.log('Usuario creado exitosamente:');
        console.log(`- ID: ${result.user.id}`);
        console.log(`- Email: ${result.user.email}`);
        console.log(`- Rol: ${result.user.role}`);
        
    } catch (error: any) {
        if (error.message === 'Email already in use') {
            console.log('El usuario abogado@gmail.com ya existe en la base de datos.');
        } else {
            console.error('Error al crear el usuario abogado:', error);
        }
    } finally {
        await prisma.$disconnect();
    }
}

createLawyer();
