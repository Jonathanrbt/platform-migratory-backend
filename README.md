# platform-migratory-backend

#iniciar prisma
npx prisma generate

#crear base de datos
npx prisma migrate dev --name init_database

#Crear un nuevo abogado
npx ts-node create_lawyer.ts