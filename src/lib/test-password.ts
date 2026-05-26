import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@ciprianoescola.com.br'
  const password = 'CiprianoAdmin2026!'

  console.log(`Buscando usuário ${email} no Supabase...`)
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    console.error('Usuário não encontrado!')
    return
  }

  console.log('Usuário encontrado. Comparando a senha...')
  const isValid = await bcrypt.compare(password, user.password)

  console.log('--- RESULTADO DO TESTE DE SENHA ---')
  console.log(`Senha testada: "${password}"`)
  console.log(`Senha é válida? ${isValid ? 'SIM! ✅' : 'NÃO! ❌'}`)
  console.log('------------------------------------')
}

main()
  .catch((e) => {
    console.error('Erro no diagnóstico de senha:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
