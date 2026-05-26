import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@ciprianoescola.com.br'
  const password = 'CiprianoAdmin2026!'

  console.log('--- TESTANDO ENCONTRO DO USUÁRIO ---')
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    console.error('❌ Usuário não encontrado no banco de dados!')
    return
  }

  console.log('✅ Usuário encontrado:', { id: user.id, email: user.email, name: user.name })

  console.log('--- COMPATIBILIDADE DE SENHA ---')
  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (isPasswordValid) {
    console.log('✅ Senha VALIDADA com sucesso!')
  } else {
    console.error('❌ Senha INVÁLIDA!')
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
