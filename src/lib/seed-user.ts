import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = 'admin@ciprianoescola.com.br'
  const adminName = 'André Cipriano'
  const adminPassword = 'CiprianoAdmin2026!'

  console.log('Iniciando o seeding de usuários para a Cipriano Escola de Negócios...')

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail }
  })

  if (existingUser) {
    console.log(`Usuário ${adminEmail} já existe no banco. Seeding não necessário.`)
    return
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  const admin = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'ADMIN'
    }
  })

  console.log(`Usuário administrador criado com sucesso!`)
  console.log(`E-mail: ${admin.email}`)
  console.log(`Perfil: ${admin.role}`)
}

main()
  .catch((e) => {
    console.error('Erro ao executar seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
